#!/usr/bin/env bash
# Dispatch eligible GitHub issues to Cursor Cloud Agents.
# GitHub stays the control plane: this script never merges pull requests.
set -euo pipefail

MAX_ACTIVE_AGENTS=4
STARTING_REF="main"
CURSOR_API_BASE="${CURSOR_API_BASE:-https://api.cursor.com}"

DISPATCH_RESULT=""
ISSUE=""
labels_json="[]"
comments=""
any_failed=0

log() {
  printf 'cursor-dispatch: %s\n' "$*"
}

sanitize() {
  local text
  text="$(cat)"
  if [[ -n "${CURSOR_API_KEY:-}" ]]; then
    text="${text//${CURSOR_API_KEY}/[REDACTED]}"
  fi
  printf '%s' "${text:0:800}"
}

has_label() {
  jq -e --arg name "$1" 'index($name) != null' <<<"$labels_json" >/dev/null
}

add_label() {
  local name="$1"
  local payload
  if has_label "$name"; then
    return 0
  fi
  payload="$(jq -n --arg name "$name" '{labels: [$name]}')"
  gh api --method POST "repos/${GITHUB_REPOSITORY}/issues/${ISSUE}/labels" --input - <<<"$payload" >/dev/null
  labels_json="$(jq -c --arg name "$name" '. + [$name]' <<<"$labels_json")"
}

remove_label() {
  local name="$1"
  local encoded
  if ! has_label "$name"; then
    return 0
  fi
  encoded="$(jq -rn --arg name "$name" '$name | @uri')"
  gh api --method DELETE "repos/${GITHUB_REPOSITORY}/issues/${ISSUE}/labels/${encoded}" >/dev/null
  labels_json="$(jq -c --arg name "$name" 'map(select(. != $name))' <<<"$labels_json")"
}

comment_once() {
  local marker="$1"
  local text="$2"
  local payload
  if [[ "$comments" == *"$marker"* ]]; then
    return 0
  fi
  payload="$(jq -n --arg body "${marker}"$'\n\n'"${text}" '{body: $body}')"
  gh api --method POST "repos/${GITHUB_REPOSITORY}/issues/${ISSUE}/comments" --input - <<<"$payload" >/dev/null
  comments+=$'\n'"${marker}"$'\n'"${text}"
}

actions_run_line() {
  if [[ -n "${GITHUB_RUN_ID:-}" && -n "${GITHUB_SERVER_URL:-}" ]]; then
    printf '\n\nActions run: %s/%s/actions/runs/%s' \
      "$GITHUB_SERVER_URL" "$GITHUB_REPOSITORY" "$GITHUB_RUN_ID"
  fi
}

# Record a terminal failure on the issue, then let the caller return non-zero.
fail_dispatch() {
  local reason="$1"
  local safe
  safe="$(printf '%s' "$reason" | sanitize)"
  add_label "cursor:failed" || true
  remove_label "cursor:ready" || true
  remove_label "cursor:queued" || true
  comment_once "<!-- cursor-dispatch:failed -->" \
    "$(printf 'Cursor Cloud Agent dispatch failed.\n\n```\n%s\n```%s' "$safe" "$(actions_run_line)")" || true
  DISPATCH_RESULT="failed"
  log "issue #${ISSUE} failed: ${safe}"
}

normalize_label() {
  local value="$1"
  value="${value,,}"
  value="${value// /}"
  printf '%s' "$value"
}

issue_kind() {
  local label normalized
  local epic=0
  local leaf=0
  local typed=0
  while IFS= read -r label; do
    [[ -z "$label" ]] && continue
    normalized="$(normalize_label "$label")"
    case "$normalized" in
      type:epic | epic)
        epic=1
        typed=1
        ;;
      type:story | story | type:task | task)
        leaf=1
        typed=1
        ;;
      type:*)
        typed=1
        ;;
      *) ;;
    esac
  done < <(jq -r '.[]' <<<"$labels_json")
  if ((epic == 1)); then
    printf 'epic'
  elif ((typed == 1 && leaf == 0)); then
    printf 'other'
  else
    printf 'leaf'
  fi
}

already_launched() {
  if has_label "cursor:running"; then
    return 0
  fi
  if [[ "$comments" == *"<!-- cursor-dispatch:launched -->"* ]]; then
    return 0
  fi
  if [[ "$comments" =~ https://cursor\.com/agents/[A-Za-z0-9_-]+ ]]; then
    return 0
  fi
  return 1
}

cursor_request() {
  local method="$1"
  local url="$2"
  local payload="${3:-}"
  local body_file stderr_file http_code
  body_file="$(mktemp)"
  stderr_file="$(mktemp)"
  if [[ "$method" == "GET" ]]; then
    if ! http_code="$(
      curl -sS --max-time 60 --retry 2 --retry-delay 1 --retry-all-errors \
        -u "${CURSOR_API_KEY}:" \
        -H "Accept: application/json" \
        -o "$body_file" \
        -w "%{http_code}" \
        "$url" 2>"$stderr_file"
    )"; then
      :
    fi
  else
    if ! http_code="$(
      curl -sS --max-time 60 \
        -u "${CURSOR_API_KEY}:" \
        -H "Accept: application/json" \
        -H "Content-Type: application/json" \
        -o "$body_file" \
        -w "%{http_code}" \
        -X POST \
        --data-binary "$payload" \
        "$url" 2>"$stderr_file"
    )"; then
      :
    fi
  fi
  if [[ -z "${http_code:-}" ]]; then
    http_code="000"
  fi
  CURSOR_HTTP_CODE="$http_code"
  CURSOR_BODY_FILE="$body_file"
  if [[ -s "$stderr_file" ]]; then
    CURSOR_ERROR="$(cat "$stderr_file")"
  else
    CURSOR_ERROR=""
  fi
  rm -f "$stderr_file"
}

count_active_agents() {
  local cursor="" pages=0 body next page_active
  ACTIVE_COUNT=0
  while ((pages < 20)); do
    local url="${CURSOR_API_BASE}/v1/agents?limit=100&includeArchived=false"
    if [[ -n "$cursor" ]]; then
      local encoded
      encoded="$(jq -rn --arg cursor "$cursor" '$cursor | @uri')"
      url="${url}&cursor=${encoded}"
    fi
    cursor_request GET "$url"
    body="$(cat "$CURSOR_BODY_FILE")"
    rm -f "$CURSOR_BODY_FILE"
    if [[ ! "$CURSOR_HTTP_CODE" =~ ^2 ]]; then
      local detail
      detail="$(printf '%s\n%s' "$body" "$CURSOR_ERROR" | sanitize)"
      fail_dispatch "Cursor list agents failed with HTTP ${CURSOR_HTTP_CODE}: ${detail}"
      return 1
    fi
    if ! page_active="$(jq '[.items[]? | select(.status == "ACTIVE")] | length' <<<"$body")"; then
      fail_dispatch "Cursor list agents returned invalid JSON."
      return 1
    fi
    ACTIVE_COUNT=$((ACTIVE_COUNT + page_active))
    if ((ACTIVE_COUNT >= MAX_ACTIVE_AGENTS)); then
      return 0
    fi
    next="$(jq -r '.nextCursor // empty' <<<"$body")"
    if [[ -z "$next" ]]; then
      return 0
    fi
    cursor="$next"
    pages=$((pages + 1))
  done
  fail_dispatch "Cursor list agents pagination did not finish."
  return 1
}

build_prompt() {
  local title="$1"
  local body="$2"
  if [[ -z "$body" ]]; then
    body="(no description)"
  fi
  if ((${#body} > 50000)); then
    body="${body:0:50000}"$'\n\n[issue body truncated]'
  fi
  jq -rn \
    --arg repo_url "https://github.com/${GITHUB_REPOSITORY}" \
    --arg number "$ISSUE" \
    --arg title "$title" \
    --arg body "$body" \
    '"Implement exactly this story.\n\nRepository: \($repo_url)\nIssue: #\($number)\nTitle: \($title)\n\nIssue body:\n\($body)\n\nRequirements:\n- Implement exactly this story.\n- Open a pull request.\n- Put `Closes #\($number)` in the PR body.\n- Follow AGENTS.md quality gates.\n- Do not deploy.\n- Do not merge the pull request.\n"'
}

agent_name() {
  local title="$1"
  local name
  title="${title//$'\n'/ }"
  name="Issue #${ISSUE}: ${title}"
  if ((${#name} > 100)); then
    name="${name:0:97}..."
  fi
  printf '%s' "$name"
}

load_comments() {
  local raw
  if ! raw="$(gh api --paginate "repos/${GITHUB_REPOSITORY}/issues/${ISSUE}/comments")"; then
    fail_dispatch "Could not read comments on #${ISSUE}."
    return 1
  fi
  if [[ -z "${raw//[[:space:]]/}" ]]; then
    raw="[]"
  fi
  if ! comments="$(jq -r '.[].body // empty' <<<"$raw")"; then
    fail_dispatch "Could not parse comments on #${ISSUE}."
    return 1
  fi
}

load_open_blockers() {
  local page=1 page_json count
  OPEN_BLOCKERS=()
  while ((page <= 20)); do
    if ! page_json="$(gh api "repos/${GITHUB_REPOSITORY}/issues/${ISSUE}/dependencies/blocked_by?per_page=100&page=${page}")"; then
      fail_dispatch "Could not read blocked-by dependencies for #${ISSUE}."
      return 1
    fi
    if ! jq -e 'type == "array"' <<<"$page_json" >/dev/null; then
      fail_dispatch "Unexpected blocked-by response for #${ISSUE}."
      return 1
    fi
    count="$(jq 'length' <<<"$page_json")"
    while IFS= read -r number; do
      [[ -z "$number" ]] && continue
      OPEN_BLOCKERS+=("$number")
    done < <(jq -r '.[] | select(.state == "open") | .number' <<<"$page_json")
    if ((count < 100)); then
      return 0
    fi
    page=$((page + 1))
  done
  fail_dispatch "Blocked-by dependencies for #${ISSUE} exceeded the page limit."
  return 1
}

create_agent() {
  local prompt="$1"
  local name="$2"
  local payload body agent_id agent_url run_id
  payload="$(
    jq -n \
      --arg text "$prompt" \
      --arg name "$name" \
      --arg repo_url "https://github.com/${GITHUB_REPOSITORY}" \
      --arg ref "$STARTING_REF" \
      '{
        prompt: {text: $text},
        repos: [{url: $repo_url, startingRef: $ref}],
        autoCreatePR: true,
        name: $name
      }'
  )"
  cursor_request POST "${CURSOR_API_BASE}/v1/agents" "$payload"
  body="$(cat "$CURSOR_BODY_FILE")"
  rm -f "$CURSOR_BODY_FILE"
  if [[ ! "$CURSOR_HTTP_CODE" =~ ^2 ]]; then
    local detail
    detail="$(printf '%s\n%s' "$body" "$CURSOR_ERROR" | sanitize)"
    fail_dispatch "Cursor create agent failed with HTTP ${CURSOR_HTTP_CODE}: ${detail}"
    return 1
  fi
  if ! agent_id="$(jq -r '.agent.id // empty' <<<"$body")"; then
    fail_dispatch "Cursor create agent returned invalid JSON."
    return 1
  fi
  agent_url="$(jq -r '.agent.url // empty' <<<"$body")"
  run_id="$(jq -r '.run.id // .agent.latestRunId // empty' <<<"$body")"
  if [[ -z "$agent_id" || -z "$agent_url" ]]; then
    fail_dispatch "Cursor create agent response did not include an agent id and url."
    return 1
  fi
  # Record the launch before anything else so a partial GitHub failure cannot
  # start a second agent on the next pass.
  local record_failed=0
  add_label "cursor:running" || record_failed=1
  comment_once "<!-- cursor-dispatch:launched -->" \
    "$(printf 'Cursor Cloud Agent started for this issue.\n\n- Agent ID: `%s`\n- Agent URL: %s\n- Run ID: `%s`\n\nThe agent may open a pull request. This workflow does not merge.%s' \
      "$agent_id" "$agent_url" "${run_id:-unknown}" "$(actions_run_line)")" || record_failed=1
  remove_label "cursor:ready" || record_failed=1
  remove_label "cursor:queued" || record_failed=1
  remove_label "cursor:failed" || record_failed=1
  DISPATCH_RESULT="launched"
  log "issue #${ISSUE} launched agent ${agent_id} run ${run_id:-unknown}"
  if ((record_failed != 0)); then
    log "issue #${ISSUE} launched, but updating the GitHub issue failed"
    return 1
  fi
}

dispatch_issue() {
  local issue_json title body state kind blocker_list blocker
  ISSUE="$1"
  DISPATCH_RESULT=""
  labels_json="[]"
  comments=""
  log "considering issue #${ISSUE}"

  if ! issue_json="$(gh api "repos/${GITHUB_REPOSITORY}/issues/${ISSUE}")"; then
    fail_dispatch "Could not read issue #${ISSUE}."
    return 1
  fi
  labels_json="$(jq -c '[.labels[]?.name]' <<<"$issue_json")"
  title="$(jq -r '.title // ""' <<<"$issue_json")"
  body="$(jq -r '.body // ""' <<<"$issue_json")"
  state="$(jq -r '.state // ""' <<<"$issue_json")"

  if jq -e '.pull_request != null' <<<"$issue_json" >/dev/null; then
    remove_label "cursor:ready" || true
    DISPATCH_RESULT="pull_request"
    log "issue #${ISSUE} is a pull request; skipping"
    return 0
  fi

  load_comments || return 1

  if already_launched; then
    add_label "cursor:running"
    remove_label "cursor:ready"
    remove_label "cursor:queued"
    remove_label "cursor:failed"
    DISPATCH_RESULT="duplicate"
    log "issue #${ISSUE} already has a Cloud Agent; not launching again"
    return 0
  fi

  if [[ "$state" != "open" ]]; then
    remove_label "cursor:ready"
    remove_label "cursor:queued"
    remove_label "cursor:failed"
    comment_once "<!-- cursor-dispatch:skipped -->" \
      "Not dispatched because the issue is ${state}."
    DISPATCH_RESULT="closed"
    log "issue #${ISSUE} is ${state}; skipping"
    return 0
  fi

  kind="$(issue_kind)"
  if [[ "$kind" != "leaf" ]]; then
    remove_label "cursor:ready"
    remove_label "cursor:queued"
    remove_label "cursor:failed"
    if [[ "$kind" == "epic" ]]; then
      comment_once "<!-- cursor-dispatch:skipped -->" \
        "Not dispatched because this issue is an epic. Cloud Agents run only for stories, tasks, or issues with no type label."
    else
      comment_once "<!-- cursor-dispatch:skipped -->" \
        "Not dispatched because this issue is not a leaf story or task. Cloud Agents run only for stories, tasks, or issues with no type label."
    fi
    DISPATCH_RESULT="skipped"
    log "issue #${ISSUE} skipped (${kind})"
    return 0
  fi

  load_open_blockers || return 1
  if ((${#OPEN_BLOCKERS[@]} > 0)); then
    blocker_list=""
    for blocker in "${OPEN_BLOCKERS[@]}"; do
      blocker_list+="#${blocker} "
    done
    remove_label "cursor:ready"
    remove_label "cursor:failed"
    add_label "cursor:queued"
    comment_once "<!-- cursor-dispatch:blocked -->" \
      "$(printf 'Not dispatched because this issue is still blocked by open issues: %s.\n\nIt stays labeled `cursor:queued` and will be retried after those blockers close.%s' \
        "${blocker_list% }" "$(actions_run_line)")"
    DISPATCH_RESULT="blocked"
    log "issue #${ISSUE} blocked by ${blocker_list% }"
    return 0
  fi

  count_active_agents || return 1
  if ((ACTIVE_COUNT >= MAX_ACTIVE_AGENTS)); then
    remove_label "cursor:ready"
    remove_label "cursor:failed"
    add_label "cursor:queued"
    comment_once "<!-- cursor-dispatch:queued -->" \
      "$(printf 'Waiting for Cursor Cloud Agent capacity. %s agents are already ACTIVE, which is the maximum for this dispatcher.\n\nThis issue stays labeled `cursor:queued` and will be retried when a slot is free.%s' \
        "$ACTIVE_COUNT" "$(actions_run_line)")"
    DISPATCH_RESULT="capacity"
    log "issue #${ISSUE} queued; active agents=${ACTIVE_COUNT}"
    return 0
  fi

  create_agent "$(build_prompt "$title" "$body")" "$(agent_name "$title")"
}

drain_queued() {
  local raw number
  if ! raw="$(gh issue list --repo "$GITHUB_REPOSITORY" --state open --label "cursor:queued" --limit 100 --json number,createdAt)"; then
    log "could not list cursor:queued issues"
    return 1
  fi
  while IFS= read -r number; do
    [[ -z "$number" ]] && continue
    dispatch_issue "$number" || any_failed=1
    if [[ "$DISPATCH_RESULT" == "capacity" ]]; then
      log "capacity is full; stopping the queue drain"
      break
    fi
  done < <(jq -r 'sort_by(.createdAt) | .[].number' <<<"$raw")
}

main() {
  if [[ -z "${GITHUB_REPOSITORY:-}" ]]; then
    log "GITHUB_REPOSITORY is required"
    exit 1
  fi
  if [[ -z "${CURSOR_API_KEY:-}" ]]; then
    log "CURSOR_API_KEY is not set"
    exit 1
  fi
  if [[ -z "${GH_TOKEN:-}${GITHUB_TOKEN:-}" ]]; then
    log "GH_TOKEN or GITHUB_TOKEN is required"
    exit 1
  fi

  case "${EVENT_NAME:-}" in
    schedule)
      drain_queued
      ;;
    issues)
      if [[ -z "${ISSUE_NUMBER:-}" ]]; then
        log "ISSUE_NUMBER is required for labeled issues"
        exit 1
      fi
      dispatch_issue "$ISSUE_NUMBER" || any_failed=1
      ;;
    *)
      log "unsupported EVENT_NAME=${EVENT_NAME:-}"
      exit 1
      ;;
  esac

  if ((any_failed != 0)); then
    exit 1
  fi
}

main "$@"

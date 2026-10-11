# CI and production deployment

Quality checks and production deployment are separate. Quality stays parallel. Production deployment for this web app is serialized, and a commit that is no longer `origin/main` does not deploy.

## Triggers

| Event | `quality` | Production deploy |
| --- | --- | --- |
| Pull request | Yes | No |
| Push to `main` | Yes | Yes, after `quality` succeeds |
| `workflow_dispatch` with `deploy_production=true` | Yes | Yes, after `quality` succeeds |
| `workflow_dispatch` with `deploy_production=false` | Yes | No |

Pushing to `main` deploys after quality. That is a change from the previous manual-only `workflow_dispatch` path. `.do/app.yaml` keeps `deploy_on_push: false`, so DigitalOcean does not start a second deploy when `main` moves. The GitHub Actions deploy job is the only production path.

The required check name remains `quality`. It aggregates `quality-gates` and all three Playwright shards and fails if either dependency is failed, cancelled, or skipped. No branch-protection update is needed: the existing GitHub Actions `quality` check remains required. Guard and deploy also depend directly on both quality jobs.

## Parallel CI

`CI_MAX_PARALLEL` defaults to `4`. It records the intended capacity in the workflow environment and in the quality log. It is not a queue.

Each run starts four independent jobs: `quality-gates` plus `Playwright shard 1/3`, `2/3`, and `3/3`. The matrix has `max-parallel: 3` and `fail-fast: false`, so a failed shard does not cancel sibling diagnostics. After all four finish, the lightweight `quality` aggregate runs, followed by the existing production guard/deploy where applicable. There is no workflow-wide serialization or cross-run four-slot semaphore; account runner capacity can still introduce queue time.

The required E2E command retains the auth grep exclusion and both desktop/mobile projects, uses file-level sharding (no `fullyParallel` change), and sets two workers per shard. Local defaults, auth shells, and Front Porch production visuals retain one worker. Auth shells run exactly once with their existing soft-fail policy in `quality-gates`; production visual comparisons run exactly once there with `ATLAS_VISUAL_PRODUCTION=1`. Every existing non-browser gate, coverage upload, Next/Docker build, and security scan remains in that job and runs independently of required E2E.

Each shard publishes a uniquely named `playwright-shard-N` artifact containing JUnit, an HTML report, screenshots/attachments, traces, and error contexts, plus a `Playwright Results N/3` check. Reports are per shard; there is no merge job or new reporting service. Test command failures determine the shard outcome regardless of reporter check settings. Existing auth/visual artifacts and result checks remain available.

Expected elapsed time becomes the slower of the general quality job and the longest shard, plus deployment time. Targets are <=15 minutes, stretch <=12; confirm with a successful merged production run rather than assuming a threefold end-to-end speedup.

## Production concurrency

The `deploy` job uses concurrency group `atlas-web-production` unless the Actions variable `WEB_PRODUCTION_CONCURRENCY_GROUP` is set. `cancel-in-progress` is `true`: a newer deploy job cancels the in-progress deploy job in that group.

The previous group name was `web-production`. Runs that started before the rename still hold that old group until they finish.

The web app does not share this group with the API. A superseded candidate exits in `deploy-guard` before it takes the lock, so a stale run does not cancel the current deploy. The deploy job checks `origin/main` again immediately before the DigitalOcean action, after it has entered the concurrency group.

## Latest main wins

`LATEST_MAIN_WINS` defaults to `true`. Set the Actions variable to `false` to disable the comparison. Any other value, including an unset variable, keeps the guard on.

Immediately before deployment the job fetches `origin/main` and compares it to this run's `github.sha`. The deploy job checks out that same SHA. It does not reset the workspace to a newer `main` and it does not rebuild a different commit in Actions.

If the candidate is no longer `origin/main`, the job logs a successful skip:

```text
Deployment skipped.
Candidate SHA: <candidate>
Current main SHA: <origin/main>
Reason: superseded
app=web
result=skip
```

The same log includes `run_id`, `run_url`, `branch`, and `timestamp`. Opening the gate logs `result=pending` for that same identity. The DigitalOcean step then logs `result=success` or `result=failure`. A failed deploy stays failed.

DigitalOcean App Platform builds the `main` branch in `.do/app.yaml` when the action runs. The guard refuses to start that build unless this run's validated SHA is still `origin/main`. A push that lands after the check and before App Platform clones `main` can still be included in DigitalOcean's build. That interval is the platform's branch-tip clone, not an Actions rebuild of a newer SHA.

## Rollback

### Branded API cutover (Web #355)

The production manifest and quality build/Docker arguments use `https://api.onehealthatlas.org` for `NEXT_PUBLIC_API_BASE_URL`. This is a build-time value: changing a runtime environment setting alone does not update the browser bundle. The existing deploy action applies the checked-out app manifest and rebuilds the existing DigitalOcean service after approved merge. No separate manual environment change or new service is needed.

Deploy the focused API metadata/CORS follow-up first, including its approved live CORS addition for legacy Swagger. Then approve this Web cutover. Before and after Web deployment, compare the live spec and preserve unrelated settings, domains and authentication values. Verify the deployed source SHA, ACTIVE phase, live `NEXT_PUBLIC_API_BASE_URL` and browser requests from public explorer and authenticated Ask Atlas. Keep Web #355 open until those checks pass. The retained `api.carawaylabs.com` remains available to existing clients and for rollback.

Roll back from the DigitalOcean App Platform deployment history to the last successful deployment. That restores the image App Platform already built.

A revert commit on `main` is a new candidate. It deploys only after `quality` passes and only if it is still `origin/main`.

Re-running an older Actions deploy for a superseded SHA is skipped while `LATEST_MAIN_WINS` is on. Disabling the guard does not make App Platform build that older SHA. The action still applies the checked-out app spec, and App Platform still builds `branch: main`. Use the control-panel rollback to restore an older image.

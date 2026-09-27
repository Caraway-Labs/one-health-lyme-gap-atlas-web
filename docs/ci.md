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

The required check name remains `quality`. A failed quality job does not deploy.

## Parallel CI

`CI_MAX_PARALLEL` defaults to `4`. It records the intended capacity in the workflow environment and in the quality log. It is not a queue.

This workflow has one `quality` job and no matrix, so `strategy.max-parallel` does not apply. A GitHub concurrency group runs a single member at a time and would serialize CI, so quality has no concurrency group. Separate pull requests and `main` pushes run at the same time, up to the GitHub-hosted runner limit for the account. Setting `CI_MAX_PARALLEL` does not change that limit.

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

Roll back from the DigitalOcean App Platform deployment history to the last successful deployment. That restores the image App Platform already built.

A revert commit on `main` is a new candidate. It deploys only after `quality` passes and only if it is still `origin/main`.

Re-running an older Actions deploy for a superseded SHA is skipped while `LATEST_MAIN_WINS` is on. Disabling the guard does not make App Platform build that older SHA. The action still applies the checked-out app spec, and App Platform still builds `branch: main`. Use the control-panel rollback to restore an older image.

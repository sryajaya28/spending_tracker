# Ready report (what an agent sends when a branch is done)

Keep it to one screen. Every line is either a fact that was checked or says "not checked".

```
ready: <branch> (<commit>)            tests: <n>/<n> pass (full suite), affected: <names>
Request: <one line, owner's words>     Design: <Figma link or "no design change, because ...">
Acceptance checks (from "Done when"):
  [x] <check>  -> <how it was verified: test name / real-browser screenshot / manual>
  [ ] <check>  -> not checked, because ...
Real-browser proof: <screenshots from tools/staging_shot.js or the preview: phone + dark for UI changes>
Differences from the design: <none | list>
Not verified: <real phone, real third-party service, production data ...>
Decisions needed: <none | question + recommendation>
Migrations: <none | file names, backwards compatible?>
Steps to try: 1. ... 2. ...
Changelog file: docs/changes/<date>-<name>.md
```

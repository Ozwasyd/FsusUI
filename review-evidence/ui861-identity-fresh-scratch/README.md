# Fresh-checkout identity regression repair

Source `b7f143099ab8bbb6be69f49f6dbfd6c97831d902`, one added line relative to `a58cae49d4cbbed48e62c877bab24a7c0041bef6`. The original Node entry passed all18 controls with `.tmp` absent immediately before execution. See fresh-original-node-tests.json/log for exact-head evidence, assertion-preservation.json for exact one-line comparison, and draft-pr-handoff.json for the full current-template root handoff.

Earlier unprepared17/18 FAIL and prepared18/18 PASS remain unchanged at evidence commit374086720f5812f89f71489fa678201449c77486. No new browser evidence or full-CI acceptance is claimed. The denied installation stays stopped.

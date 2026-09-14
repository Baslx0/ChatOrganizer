# Safety boundaries

The executor is intentionally separate from analysis.

Any browser execution adapter must:

1. use a visible, user-controlled authenticated session;
2. perform actions sequentially, not in parallel bursts;
3. verify the result of each write before continuing;
4. checkpoint progress so a stopped run can resume safely;
5. support pause and stop controls;
6. stop immediately on CAPTCHA, MFA/verification, 403, 429, logout, or unexpected UI;
7. never bypass anti-bot, rate limits, access controls, or verification flows;
8. require explicit human approval before write actions;
9. keep deletion unsupported by default.

If the platform signals that automation is not permitted or requires additional verification, stop and hand control back to the user.

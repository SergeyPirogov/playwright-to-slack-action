**Playwirght to Slack action**

```
- name: Playright to Slack
  uses: SergeyPirogov/playwright-to-slack-action@0master
  if: success() || failure()
  with: 
    filePath: 'playwright-report/test-results.json'
    channel: 'e2e-tests'
    slackToken: ${{ secrets.SLACK_TOKEN }} 
```

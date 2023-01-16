** Playwirght action

```
- name: Playright to Slack
  uses: SergeyPirogov/playwright-to-slack-action@0.1.0
  with: 
    filePath: 'playwright-report/test-results.json'
    channel: 'e2e-tests'
    slackToken: ${{ secrets.SLACK_TOKEN }} 
```
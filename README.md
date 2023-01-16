=== Playwirght action

```
- name: Reqover action step 
  uses: ./ 
  with: 
    filePath: 'playwright-report/test-results.json'
    channel: 'e2e-tests'
    slackToken: ${{ secrets.SLACK_TOKEN }} 
```
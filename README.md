=== Playwirght action

```
- name: Reqover action step 
  uses: ./ 
  with: 
    filePath: 'playwright-report/test-results.json'
    buildName: PR-1 
    slackToken: ${{ secrets.SLACK_TOKEN }} 
```
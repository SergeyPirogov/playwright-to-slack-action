const core = require("@actions/core");
const fs = require("fs");
const { WebClient } = require("@slack/web-api");

function stripAnsiCodes(str) {
  if (!str) {
    return str;
  }
  return str.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ""
  );
}

async function run() {
  try {
    const filePath = core.getInput("filePath") || "./test-results.json";
    const slackToken = core.getInput("slackToken");
    const channel = core.getInput("channel");
    const environment = core.getInput("environment");
    const filter = core.getInput("filter");

    const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
    const GITHUB_RUN_ID = process.env.GITHUB_RUN_ID;

    const rawData = fs.readFileSync(filePath);
    const report = JSON.parse(rawData);

    const { workers, totalDuration, passed, failed } = calculateStats(report);

    const message = {
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: ":package: *Test run results*",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Environment: ${environment}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Workers: ${workers}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Filter: ${filter}`,
          },
        },
        {
          type: "divider",
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `:white_check_mark: *Passed:*\n${passed.length}`,
            },
            {
              type: "mrkdwn",
              text: `:x: *Failed:*\n${failed.length}`,
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Total duration:* ${(totalDuration / 1000 / 60).toFixed(
              2
            )}min`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `<https://github.com/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}|Details>`,
          },
        },
      ],
    };

    if (failed.length > 0) {
      message.blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: ":rotating_light: *Errors:*",
        },
      });
    }

    failed.slice(0, 10).forEach((test) => {
      message.blocks.push(
        {
          type: "divider",
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `> *${test.title}* (${(test.duration / 1000).toFixed(2)}s)\n${
              test.file
            }`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "```" + test.errorMessage + "```",
          },
        }
      );
    });

    const web = new WebClient(slackToken);
    const result = await web.chat.postMessage({
      text: "Test run results",
      channel: channel,
      blocks: message.blocks,
      username: "Github action",
      icon_emoji: ":rocket:",
    });

    // The result contains an identifier for the message, `ts`.
    console.log(
      `Successfully send message ${result.ts} in conversation ${channel}`
    );
  } catch (error) {
    core.setFailed(error.message);
  }
}

function calculateStats(report) {
  const suites = report.suites;
  const workers = report.config.workers;

  const passed = [];
  const failed = [];
  let totalDuration = 0;

  for (const suite of suites) {
    const specs = suite.specs;
    for (const spec of specs) {
      const tests = spec.tests;
      for (const test of tests) {
        const results = test.results;
        for (const result of results) {
          const testTitle = spec.title;
          const file = spec.file;
          const status = result.status;
          const errorMessage = stripAnsiCodes(result.error?.message);
          const duration = result.duration;

          const testResult = {
            file,
            title: testTitle,
            status,
            errorMessage,
            duration,
          };

          if (status === "passed") {
            passed.push(testResult);
          } else if (status === "skipped") {
            continue;
          } else {
            failed.push(testResult);
          }

          totalDuration += duration;
        }
      }
    }
  }

  return { workers, totalDuration, passed, failed };
}

run();

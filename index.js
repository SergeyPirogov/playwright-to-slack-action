const core = require("@actions/core");
const github = require("@actions/github");

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
    const ghToken = core.getInput("ghToken");

    const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
    const GITHUB_RUN_ID = process.env.GITHUB_RUN_ID;

    const duration = await getDuration(
      ghToken,
      GITHUB_REPOSITORY,
      GITHUB_RUN_ID
    );

    const rawData = fs.readFileSync(filePath);
    const report = JSON.parse(rawData);

    const { workers, passed, failed } = calculateStats(report);

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
            text: `*Total duration:* ${duration}`,
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

async function getDuration(github_token, github_repository, runId) {
  if (!github_token) {
    console.log("`Github TOKEN is not set");
    return "";
  }

  try {
    const owner = github_repository.split("/")[0];
    const repository = github_repository.split("/")[1];

    console.log(owner);
    console.log(repository);
    console.log(runId);
    
    const octokit = new github.getOctokit(github_token);
    const workflowRun = await octokit.rest.actions.getWorkflowRun({
      owner: owner,
      repo: repository,
      run_id: runId,
    });

    console.log(JSON.stringify(workflowRun, null, 2));

    const run_started_at = workflowRun.data.updated_at;

    const date = new Date(run_started_at);

    const now = new Date();
    const diffInMilliseconds = now.getTime() - date.getTime();
    const diffInSeconds = Math.floor(diffInMilliseconds / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);

    const duration = `${diffInHours % 24} hours, ${
      diffInMinutes % 60
    } minutes, and ${diffInSeconds % 60} seconds`;

    console.log(duration);
    return duration;
  } catch (error) {
    console.error("ERROR "+ error);
    return "";
  }
}

run();

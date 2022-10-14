const core = require('@actions/core');
const fs = require('fs');
const fetch = require("node-fetch");
const moment = require("moment");

const signatureDir = `./Signatures`;
if (!fs.existsSync(signatureDir)){
  fs.mkdirSync(signatureDir, { recursive: true });
}

const githubToken = core.getInput('github-token');
const repo = process.env.GITHUB_REPOSITORY;
const repoInfo = repo.split("/");
const repoOwner = repoInfo[0];
const repoName = repoInfo[1];

const body = (state, next) => {
  let issuesQuery = `first:10 after:${next}, states:${state}`;
  if (!next) {
    issuesQuery = `first:10, states:${state}`;
  }

  return JSON.stringify({
    query: `
        query {
            repository(owner:"${repoOwner}", name:"${repoName}") {
                issues(${issuesQuery}) {
                  body
                }
              }
        }`
  })
};

function getIssues(body) {
  const url = "https://api.github.com/graphql";
  const options = {
    method: "POST",
    body: body,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `bearer ${githubToken}`
    }
  };

  return fetch(url, options)
    .then(resp => resp.json())
    .then(data => {
      return {
        issues: data.data.repository.issues.edges,
        has_next: data.data.repository.issues.pageInfo.hasNextPage,
        end_cursor: data.data.repository.issues.pageInfo.endCursor,
      }
    }).catch((err) => {console.log(err)});
}

async function getOpenIssues() {
  allIssues = []

  let page = {endCursor: undefined}
  do {
    page = await getIssues(body("OPEN", page.endCursor))
    allIssues.push(...page.issues)
  } while (page.has_next) 

  return allIssues
}

async function run() {
  var openIssues = await getOpenIssues();

  openIssues.forEach(issue => {
    const matched = issue.node.body.match("^-- BEGIN SIGNATURE --(.*)-- END SIGNATURE --");
    console.log({"found": matched, "body": issue.node.body});
  })
}

run();

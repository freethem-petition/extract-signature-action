const core = require('@actions/core');
const fs = require('fs');
const fetch = require("node-fetch");
const moment = require("moment");

const signaturesDir = `./SIGNATURES`;
const statementDir = `./STATEMENT`;
if (!fs.existsSync(signaturesDir)){
  fs.mkdirSync(signaturesDir, { recursive: true });
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
                  edges {
                    node {
                      body
                      createdAt
                      author {
                        login
                      }
                    }
                  }
                  pageInfo {
                    endCursor
                    hasNextPage
                  }
                }
              }
        }`
  })
};

async function getIssues(body) {
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

  return await fetch(url, options)
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

function dumpData(author, createdAt, signature) {
  const fileName = `${author}-${createdAt}.sig`
  console.log("dumping data to", fileName)
  fs.writeFile(`${signaturesDir}/${fileName}`, signature, (err) => {
    if (err) throw err;
  });
}

async function run() {
  var openIssues = await getOpenIssues();

  openIssues.forEach(issue => {
    const author = issue.node.author.login;
    const createdAt = issue.node.createdAt;
    const matchedSignature = issue.node.body.match("/```SIGNATURE(.*)```/g");

    console.log({"found": matchedSignature, "body": issue.node.body, "created": createdAt, "author": author});

    if (matchedSignature.length < 1) {
      console.log("wrong format")
      return
    }

    const signature = matchedSignature[0].replace("\r", "").replace("\n", "")
    console.log("format", signature);

    dumpData(author, createdAt, signature);    
  });
}

run();

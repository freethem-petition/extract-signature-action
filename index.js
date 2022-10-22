const core = require('@actions/core');
const fs = require('fs');
const fetch = require("node-fetch");

const signaturesDir = `./SIGNATURES`;
const statementDir = `./STATEMENT`;
if (!fs.existsSync(signaturesDir)){
  fs.mkdirSync(signaturesDir, { recursive: true });
}
if (!fs.existsSync(statementDir)){
  fs.mkdirSync(statementDir, { recursive: true });
}

const githubToken = core.getInput('github-token');
const repo = process.env.GITHUB_REPOSITORY;
const repoInfo = repo.split("/");
const repoOwner = repoInfo[0];
const repoName = repoInfo[1];

const body = (state, next, label) => {
  let issuesQuery = `first:10, after:"${next}", states:${state}, labels:"${label}"`;
  if (!next) {
    issuesQuery = `first:10, states:${state}, labels:"${label}"`;
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
                      url
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
      if (data && data.data && data.data.repository) {
        return {
          issues: data.data.repository.issues.edges,
          has_next: data.data.repository.issues.pageInfo.hasNextPage,
          end_cursor: data.data.repository.issues.pageInfo.endCursor,
        }
      }
      return {
        issues: [],
        has_next: false,
        end_cursor: undefined
      }
    }).catch((err) => {console.log(err)});
}

async function getOpenIssuesWithSignature() {
  let allIssues = []

  let page = {end_cursor: undefined}
  do {
    page = await getIssues(body("OPEN", page.end_cursor, "add-signature"))
    allIssues.push(...page.issues)
  } while (page.has_next) 

  return allIssues
}

async function getOpenIssuesWithoutSignature() {
  let allIssues = []

  let page = {end_cursor: undefined}
  do {
    page = await getIssues(body("OPEN", page.end_cursor, "add-signature-email"))
    allIssues.push(...page.issues)
  } while (page.has_next) 

  return allIssues
}

function dumpSignatureFile(author, createdAt, content) {
  const filePath = `${signaturesDir}/${author}-${createdAt}.sig`;
  console.log("dumping singature data to", filePath);
  fs.writeFile(filePath, content, (err) => {
    if (err) throw err;
  });
}

function dumpEmailSignatureFile(author, createdAt, content) {
  const filePath = `${signaturesDir}/${author}-${createdAt}.emailsig`;
  console.log("dumping singature data to", filePath);
  fs.writeFile(filePath, content, (err) => {
    if (err) throw err;
  });
}

function appendToAscFile(signature) {
  const filePath = `${statementDir}/SHA256SUM.asc`;
  console.log("updating", filePath);
  fs.appendFile(filePath, signature, (err) => {
    if (err) throw err;
  });
}

async function run() {
  var openIssuesWithSignature = await getOpenIssuesWithSignature();
  var openIssuesWithoutSignature = await getOpenIssuesWithoutSignature();

  console.log("found", openIssuesWithSignature.length, "signed issues");
  console.log("found", openIssuesWithoutSignature.length, "signed by mail issues");

  openIssuesWithSignature.forEach(issue => {
    console.log("processing: ", issue.node.url);

    const author = issue.node.author.login;
    const createdAt = issue.node.createdAt;
    const matchedSignature = [...issue.node.body.matchAll(/```SIGNATURE([\s\S]*)```/g)];
    const matchedName = [...issue.node.body.matchAll(/```NAME ([\s\S]*)```\s*### Your email/g)];
    const matchedEmail = [...issue.node.body.matchAll(/```EMAIL ([\s\S]*)```\s*### Your signature/g)];
    
    if (!matchedSignature || matchedSignature.length < 1) {
      console.log("wrong format - signature")
      return
    }
    if (!matchedName || matchedName.length < 1) {
      console.log("wrong format - name")
      return
    }
    if (!matchedEmail || matchedEmail.length < 1) {
      console.log("wrong format - email")
      return
    }

    const name = matchedName[0][1];
    const email = matchedEmail[0][1];
    const commentLine = `Comment: ${name} - ${email}`
    const signature = matchedSignature[0][1].replace(
      "-----BEGIN PGP SIGNATURE-----",
      `-----BEGIN PGP SIGNATURE-----\n${commentLine}\n`
    )

    dumpSignatureFile(author, createdAt, signature);
    appendToAscFile(signature);
    console.log("close: ", issue.node.url);
  });

  openIssuesWithoutSignature.forEach(issue => {
    console.log("processing: ", issue.node.url);
    const author = issue.node.author.login;
    const createdAt = issue.node.createdAt;
    const matchedName = [...issue.node.body.matchAll(/```NAME ([\s\S]*)```\s*### Your email/g)];
    const matchedEmail = [...issue.node.body.matchAll(/```EMAIL ([\s\S]*)```\s*/g)];
    
    if (!matchedName || matchedName.length < 1) {
      console.log("wrong format - name")
      return
    }
    if (!matchedEmail || matchedEmail.length < 1) {
      console.log("wrong format - email")
      return
    }

    const name = matchedName[0][1];
    const email = matchedEmail[0][1];

    const content = `
    ---
    Name: ${name}
    Email: ${email}
    ---
    `;
    dumpEmailSignatureFile(author, createdAt, content);
    console.log("close: ", issue.node.url);
  });
}

run();

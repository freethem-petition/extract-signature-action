/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 460:
/***/ ((module) => {

module.exports = eval("require")("@actions/core");


/***/ }),

/***/ 782:
/***/ ((module) => {

module.exports = eval("require")("moment");


/***/ }),

/***/ 389:
/***/ ((module) => {

module.exports = eval("require")("node-fetch");


/***/ }),

/***/ 147:
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
const core = __nccwpck_require__(460);
const fs = __nccwpck_require__(147);
const fetch = __nccwpck_require__(389);
const moment = __nccwpck_require__(782);

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

function getOpenIssues() {
  allIssues = []

  do {
    page = getIssues(body("OPEN", page.endCursor))
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

})();

module.exports = __webpack_exports__;
/******/ })()
;
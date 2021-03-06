# Microsoft MakeCode

* [Try our the editors in your browser...](https://makecode.com)

[![Build Status](https://travis-ci.org/Microsoft/pxt.svg?branch=master)](https://travis-ci.org/Microsoft/pxt) 
[![Community Discord](https://img.shields.io/discord/448979533891371018.svg)](https://aka.ms/makecodecommunity)

Microsoft MakeCode is based on the open source project [Microsoft Programming Experience Toolkit (PXT)](https://github.com/Microsoft/pxt). ``Microsoft MakeCode`` is the name in the user-facing editors, ``PXT`` is used in all the GitHub sources.

PXT is a framework for creating special-purpose programming experiences for
beginners, especially focused on computer science education. PXT's underlying
programming language is a subset of TypeScript (leaving out JavaScript dynamic
features).

The main features of PXT are:
* a Blockly-based code editor along with converter to the text format
* a Monaco code editor that powers [VS Code](https://github.com/Microsoft/vscode), editor's features are listed [here](https://code.visualstudio.com/docs/editor/editingevolved).
* extensibility support to define new blocks in TypeScript
* an ARM Thumb machine code emitter
* a command-line package manager

More info:
* [About](https://makecode.com/about)
* [Documentation](https://makecode.com/docs)

Examples of Editors built with PXT:

* https://makecode.microbit.org
* https://makecode.adafruit.com
* https://makecode.chibitronics.com
* https://minecraft.makecode.com
* More editors at https://makecode.com/labs

## Branches

* `wonder_master` is the branch that we use for Code builds.
* `stable(stable build)` stable branches from the upstream reopsitory (Microsoft/pxt)
* `wonder_stable(stable build)` stable branches with our changes merged in
* To update PXT in pxt-wonder with a new stable branch from microsoft, follow these steps:
0. `git fetch upstream stable(stable build)` fetch the upstream stable branch from microsoft/pxt
    (Note, if you have not set your 'upstream' to be Microsoft/pxt branch, then you can either create a remote upstream      
    pointing to the MS repro, or you can use the MS Repro https url instead of 'upstream')
1. `git checkout stable(stable branch)` check out Microsoft's stable branch
2. `git checkout -b wonder_stable(stable build)` create a local branch off the stable branch adding the prefix `wonder_`
3. `git merge wonder_master` merge the wonder workshop specific changes from our wonder_master branch down
4. Fix any merge conflict issues. (I reccomend setting up p4 as a git mergetool)
5. `git push origin wonder_stable(StableBuild#)` Push the wonder_stable branch to github as a record of the changes
6. Build/ spotTest the new pxt changes to make sure there are no major regressions/ issues
7. go to the 'wonder_stable(Build#)' branch on github
8. click the 'new pull request' button
9. change the 'branch' to merge into to 'wonder_master' (it will default to Microsoft/pxt)
10. Create the pull request to wonder_master
11. Merge the PR into wonder_master


12. Now you need to update pxt-wonder repro's 'pxt' submodule
13. In your pxt-wonder repro, cd into `modules/pxt` submodule folder
14. `git checkout wonder_master` branch
15. git pull origin wonder_master to get the latest changes you have just committed to the pxt
16. cd ../.. to be in your 'pxt-wonder' repo
17. commit your new pxt submodule to pxt-wonder (note you may need to create a branch and merge that pr into pxt-wonder master)

Congrats, you have updated the pxt submodule!

## Running a target from localhost

Please follow the [instructions here](https://makecode.com/cli).

## Linking a target to PXT

If you are modifying your own instance of PXT and want a target (such as pxt-microbit) to use your local version, cd to the directory of the target (pxt-microbit, in our example, which should be a directory sibling of pxt) and perform

```
npm link ../pxt
```

If you have multiple checkouts of pxt, you can do the following:
* run `npm i` in pxt and the target
* in the target, run `pxt link ..\some-other-pxt` (you may need to update your CLI first by running `npm install -g pxt`)

If you run `npm i` afterwards (in either the target or pxt), you might need to repeat these steps.

## Build

First, install [Node](https://nodejs.org/en/): minimum version 8. 

To build the PXT command line tools:

```
npm install
npm run build
```

Then install the `pxt` command line tool (only need to do it once):

```
npm install -g pxt
```

After this you can run `pxt` from anywhere within the build tree.

To start the local web server, run `pxt serve` from within the root
of an app target (e.g. pxt-microbit). PXT will open the editor in your default web browser.

### Icons

There are a number of custom icons (to use in addition
to http://semantic-ui.com/elements/icon.html) in the `svgicons/` directory.
These need to be `1000x1000px`. Best start with an existing one. To see available icons go to
http://localhost:3232/icons.html (this file, along with `icons.css` containing
the generated WOFF icon font, is created during build).

If you're having trouble with display of the icon you created, try:
```
npm install -g svgo
svgo svgicons/myicon.svg
```

## Tests

The tests are located in the `tests/` subdirectory and are a combination of node and
browser tests. To execute them, run `npm run test:all` in the root directory.

## License

MIT

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Contact Us

[Get in touch](https://makecode.com/contact)

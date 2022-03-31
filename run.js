const { login_cellphone, login_status } = require("NeteaseCloudMusicApi");

const fs = require("fs");
const path = require("path");
const yargs = require("yargs");

require("./src/logger")();

let ncmaPath = path.dirname(require.resolve("NeteaseCloudMusicApi"));
const req = require(path.resolve(ncmaPath, "./util/request.js"));

// Modified modules
const cloud = require("./src/cloud");

let config;
try {
  config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
} catch (e) {
  config = {
    cookie: null,
    countrycode: "86",
    phone: null,
    password: null,
    md5_password: null,
    file: null,
    dir: null,
    custom: {
      override: false,
      name: null,
      artist: null,
      album: null
    }
  };
  fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
}

const FILE_EXTS = new Set([".mp3", ".flac", ".wav", ".m4a", ".aac", ".ape"]);

function getAllFiles(pathStr) {
  let files = [pathStr];
  let isDir = fs.lstatSync(pathStr).isDirectory();
  if (isDir) {
    files = [];
    fs.readdirSync(pathStr).forEach(file => {
      file = path.join(pathStr, file);
      if (
        !fs.lstatSync(file).isDirectory() &&
        FILE_EXTS.has(path.extname(file))
      ) {
        files.push(file);
      }
    });
  }
  return files;
}

function getParsedArgs() {
  // https://github.com/yargs/yargs/blob/main/docs/api.md
  return yargs(process.argv.slice(2))
    .option("countrycode", {
      describe: "The country code of your phone number. Default is 86",
      type: "string",
      implies: "phone",
      alias: "c"
    })
    .option("phone", {
      describe: "Your phone number",
      type: "string",
      implies: "password",
      alias: "m"
    })
    .option("password", {
      describe: "Your password",
      type: "string",
      implies: "phone",
      alias: "p"
    })
    .option("file", {
      describe: "The path of a single music file to be uploaded",
      type: "string",
      alias: "f"
    })
    .option("name", {
      describe: "Custom the song name",
      type: "string",
      implies: "file",
      alias: "n"
    })
    .option("artist", {
      describe: "Custom the artist",
      type: "string",
      implies: "file",
      alias: "a"
    })
    .option("album", {
      describe: "Custom the album",
      type: "string",
      implies: "file",
      alias: "A"
    })
    .option("dir", {
      describe: "The directory of music files to be uploaded",
      type: "string",
      alias: "d"
    })
    .option("save-cookie", {
      describe: "Save your login cookie",
      type: "boolean",
      implies: ["phone", "password"],
      alias: "S"
    })
    .option("save-login-info", {
      describe: "Save your login info",
      type: "boolean",
      implies: ["phone", "password"],
      alias: "s"
    })
    .conflicts("file", "dir")
    .requiresArg(["phone", "password", "dir"])
    .requiresArg(["file", "name", "artist", "album"])
    .group(["file", "dir"], "\nFile(s) path / directory:")
    .group(
      ["name", "artist", "album"],
      "Custom the file metadata. Only available when upload a single file:"
    )
    .group(
      ["save-cookie", "save-login-info"],
      "Save login data to ./config.json :"
    )
    .help()
    .version(false)
    .showHelpOnFail(false, "Specify --help for available options")
    .alias("help", "h").argv;
}

async function login({ countrycode = "86", phone, password, md5_password }) {
  let { body } = await login_cellphone({
    countrycode,
    phone,
    password,
    md5_password
  });
  if (body.code !== 200) {
    throw new Error(body);
  } else return body.cookie;
}

async function main() {
  let {
    countrycode,
    phone,
    password,
    file,
    dir,
    name,
    artist,
    album,
    saveLoginInfo,
    saveCookie
  } = getParsedArgs();
  let md5_password;
  let cookie = config.cookie,
    isNeedLogin = true;
  if (!phone) {
    console.logFgYellow("Login parameters not provided.");
    console.logFgGreen("Try using login data from config.json....");
    countrycode = config.countrycode || "86";
    phone = config.phone;
    password = config.password;
    md5_password = config.md5_password;
  } else {
    cookie = await login({ countrycode, phone, password });
    if (saveCookie) {
      config.cookie = cookie;
      fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
    }
    if (saveLoginInfo) {
      config.phone = phone;
      config.countrycode = countrycode;
      config.password = password;
      fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
    }
    isNeedLogin = false;
  }
  if (cookie && isNeedLogin) {
    console.logFgYellow("Try cookie login...");
    let {
      body: {
        data: { code, account }
      }
    } = await login_status({ cookie });
    if (code === 200 && account) isNeedLogin = false;
    else {
      console.logFgRed("Cookie expired or invalid.");
    }
  }
  if (isNeedLogin) {
    if (!((password || md5_password) && phone)) {
      console.logBgRed("Login phone number or password not found.");
      process.exit(0);
    } else {
      console.logFgYellow("Try phone number & password login...");
      cookie = await login({ countrycode, phone, password, md5_password });
    }
  }
  console.logBgGreen("Login success.");

  let files = [];
  let query = { cookie };
  if (file || dir) {
    files = getAllFiles(file || dir);
  } else if (config.file || config.dir) {
    console.logFgYellow(
      "file or dir parameter not found.\nTry finding target from config.json...."
    );
    files = getAllFiles(config.file || config.dir);
  }
  if (files.length === 0) {
    console.logBgRed("No valid music file found.");
    process.exit(0);
  }
  if (file && (name || artist || album)) {
    query.custom = { override: true, name, artist, album };
  } else if (!dir && config.file && config.custom.override) {
    query.custom = config.custom;
  }

  let processed = 0;
  let failed = 0;
  let failedFiles = [];
  for (let f of files) {
    try {
      await cloud(
        Object.assign(query, {
          songFile: {
            name: path.basename(f),
            data: fs.readFileSync(f)
          }
        }),
        req
      );
    } catch (e) {
      console.logFgRed(JSON.stringify(e));
      failed += 1;
      failedFiles.push(f);
    }
    processed += 1;
    console.logFgBlue(`Processed ${processed}/${files.length} songs...`);
  }
  if (failed) {
    console.logFgRed(`\nFailed to upload ${failed} songs.`);
    console.logFgYellow(failedFiles.join("\n"));
  }
  console.logBgYellow("Finished.");
}

main();

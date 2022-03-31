## 网易云音乐上传歌曲到我的音乐云盘

我的网易云音乐 PC 端无法上传歌曲到「我的音乐云盘」好久了。

系统是 Windows 10，各种新老版本客户端尝试过，没用。

使用 Android 或 iOS 客户端可以上传，但离谱的是，上传的 FLAC 变成 MP3 了，大小没变。

我记得几年前用 Android 客户端还是正常的。

这个痛点有一年左右了，虽然但是，别人的好像是正常的？反正把 BUG 发到社区里没人理睬。

直到最近搜到些什么，受到启发开了个 Windows 7 虚拟机，结果顺利上传。

百思不得其解。

行吧，刚好发现有个网易云音乐 Node.js API 的项目。自己动手丰衣足食。

于是这样一个上传 API 的简单 Wrapper 搞定了。

把 Git 仓库拉下来，安装：

```
npm install
```

查看使用说明：

```
node run.js -h
```

## 参考内容

- https://www.xiebruce.top/1698.html
- https://github.com/Binaryify/NeteaseCloudMusicApi
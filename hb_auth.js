// 幸福分行 Google 登入（2026-09-30 負責人「雲端備份好像沒效果」）：
// 原本的雲端備份以「玩家代碼」認人，代碼和存檔放在同一個瀏覽器儲存空間——
// iPhone 清網站資料時兩者一起不見，備份找不回來。改用 Firebase Auth 的 Google
// 登入：存檔跟著 Google 帳號（RTDB /users/<uid>，規則只准本人讀寫）。
// Godot 端以 JavaScriptBridge 讀 window.hbAuth（ready／uid／name／token／error）。
// 用 redirect 流程：Godot 的按鈕事件不在瀏覽器手勢回呼裡，popup 會被擋。
(function () {
  var hb = window.hbAuth = { ready: false, available: false, uid: '', name: '', token: '', error: '' };
  hb.signIn = function () { hb.error = 'auth/not-ready'; };
  hb.signOut = function () {};
  if (!window.firebase || !firebase.auth) { hb.ready = true; hb.error = 'auth/sdk-missing'; return; }
  fetch('/__/firebase/init.json').then(function (r) {
    if (!r.ok) throw new Error('auth/no-hosting-config');
    return r.json();
  }).then(function (cfg) {
    // iOS Safari 擋第三方儲存：authDomain 改用本站網域（Firebase Hosting 同樣提供
    // /__/auth/handler），登入回跳才不會在 Safari 上靜默失敗。
    if (/\.(web\.app|firebaseapp\.com)$/.test(location.hostname)) cfg.authDomain = location.hostname;
    firebase.initializeApp(cfg);
    var auth = firebase.auth();
    hb.available = true;
    auth.getRedirectResult().catch(function (e) { hb.error = e.code || String(e); });
    auth.onIdTokenChanged(function (user) {
      if (!user) { hb.uid = ''; hb.name = ''; hb.token = ''; hb.ready = true; return; }
      hb.uid = user.uid;
      hb.name = user.displayName || user.email || '';
      user.getIdToken().then(function (t) { hb.token = t; hb.ready = true; },
        function (e) { hb.error = e.code || String(e); hb.ready = true; });
    });
    // ID token 一小時到期：每 45 分鐘強制更新
    setInterval(function () {
      var u = auth.currentUser;
      if (u) u.getIdToken(true).then(function (t) { hb.token = t; });
    }, 45 * 60 * 1000);
    hb.signIn = function () {
      hb.error = '';
      auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider())
        .catch(function (e) { hb.error = e.code || String(e); });
    };
    hb.signOut = function () { auth.signOut(); };
  }).catch(function (e) { hb.error = e.message || String(e); hb.ready = true; });
})();

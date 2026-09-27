import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, addDoc, query,
  orderBy, onSnapshot, serverTimestamp, where, getDocs, limit
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

/*
  1. Create a Firebase project at https://console.firebase.google.com/
  2. Enable Authentication > Email/Password.
  3. Create a Firestore Database.
  4. Replace the firebaseConfig values below with your project's web config.
*/

const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};

const configured = !Object.values(firebaseConfig).some(v => v.includes("PASTE_YOUR"));
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = id => document.getElementById(id);
let signupMode = false;
let currentUser = null;
let selectedUser = null;
let unsubscribeMessages = null;
let unsubscribeUsers = null;
let allUsers = [];

const authView = $("authView");
const chatView = $("chatView");
const authForm = $("authForm");
const authMessage = $("authMessage");

function initials(name = "?") {
  return name.trim().split(/\s+/).map(x => x[0]).join("").slice(0,2).toUpperCase() || "?";
}
function showToast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}
function setAuthMessage(msg) { authMessage.textContent = msg; }

$("loginTab").onclick = () => setMode(false);
$("signupTab").onclick = () => setMode(true);

function setMode(signup) {
  signupMode = signup;
  $("loginTab").classList.toggle("active", !signup);
  $("signupTab").classList.toggle("active", signup);
  $("nameLabel").classList.toggle("hidden", !signup);
  $("authButton").textContent = signup ? "Create account" : "Log in";
  setAuthMessage("");
}

authForm.addEventListener("submit", async e => {
  e.preventDefault();
  if (!configured) {
    setAuthMessage("Add your Firebase configuration in script.js first.");
    return;
  }
  const email = $("email").value.trim();
  const password = $("password").value;
  try {
    $("authButton").disabled = true;
    if (signupMode) {
      const name = $("displayName").value.trim() || email.split("@")[0];
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid, displayName: name, email,
        createdAt: serverTimestamp()
      });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (err) {
    setAuthMessage(friendlyError(err));
  } finally {
    $("authButton").disabled = false;
  }
});

$("logoutButton").onclick = () => signOut(auth);
$("profileButton").onclick = openProfile;
$("newChatButton").onclick = async () => { await loadUsers(); openModal("newChatModal"); renderModalUsers(""); };
$("backButton").onclick = () => {
  $("chat-panel")?.classList.remove("mobile-hidden");
  $("conversation").classList.add("hidden");
  $("emptyState").classList.remove("hidden");
};
document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => $(b.dataset.close).classList.add("hidden"));

$("saveProfile").onclick = async () => {
  const name = $("editName").value.trim();
  if (!name) return;
  try {
    await updateProfile(currentUser, { displayName: name });
    await setDoc(doc(db, "users", currentUser.uid), { displayName: name }, { merge: true });
    $("profileName").textContent = name;
    $("profileAvatar").textContent = initials(name);
    $("profileMessage").textContent = "Profile saved.";
    renderUsers();
  } catch (e) {
    $("profileMessage").textContent = friendlyError(e);
  }
};

$("messageForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!selectedUser) return;
  const input = $("messageInput");
  const text = input.value.trim();
  if (!text) return;
  input.disabled = true;
  try {
    const chatId = chatIdFor(currentUser.uid, selectedUser.uid);
    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderId: currentUser.uid,
      receiverId: selectedUser.uid,
      text,
      createdAt: serverTimestamp()
    });
    await setDoc(doc(db, "chats", chatId), {
      participants: [currentUser.uid, selectedUser.uid],
      lastMessage: text,
      updatedAt: serverTimestamp()
    }, { merge: true });
    input.value = "";
  } catch (e) {
    showToast(friendlyError(e));
  } finally { input.disabled = false; input.focus(); }
});

$("searchUsers").addEventListener("input", e => renderUsers(e.target.value));
$("modalUserSearch").addEventListener("input", e => renderModalUsers(e.target.value));

function chatIdFor(a, b) { return [a, b].sort().join("_"); }

function friendlyError(err) {
  const code = err?.code || "";
  const map = {
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/email-already-in-use": "That email already has an account.",
    "auth/invalid-email": "Please enter a valid email.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "permission-denied": "Firebase permissions blocked this action."
  };
  return map[code] || err?.message || "Something went wrong.";
}

onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (user) {
    authView.classList.add("hidden");
    chatView.classList.remove("hidden");
    $("profileButton").textContent = initials(user.displayName || user.email);
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      displayName: user.displayName || user.email.split("@")[0],
      email: user.email
    }, { merge: true });
    await loadUsers();
  } else {
    authView.classList.remove("hidden");
    chatView.classList.add("hidden");
    if (unsubscribeUsers) unsubscribeUsers();
    if (unsubscribeMessages) unsubscribeMessages();
  }
});

async function loadUsers() {
  if (!currentUser) return;
  const q = query(collection(db, "users"), limit(100));
  if (unsubscribeUsers) unsubscribeUsers();
  unsubscribeUsers = onSnapshot(q, snap => {
    allUsers = snap.docs.map(d => d.data()).filter(u => u.uid !== currentUser.uid);
    renderUsers($("searchUsers").value);
  }, err => showToast(friendlyError(err)));
}

function renderUsers(search = "") {
  const term = search.toLowerCase().trim();
  const list = allUsers.filter(u =>
    (u.displayName || "").toLowerCase().includes(term) ||
    (u.email || "").toLowerCase().includes(term)
  );
  $("userList").innerHTML = list.length ? list.map(userButton).join("") :
    `<div class="muted" style="padding:18px;font-size:13px">No classmates found.</div>`;
  $("userList").querySelectorAll("[data-uid]").forEach(btn =>
    btn.onclick = () => selectUser(allUsers.find(u => u.uid === btn.dataset.uid))
  );
}

function renderModalUsers(search = "") {
  const term = search.toLowerCase().trim();
  const list = allUsers.filter(u =>
    (u.displayName || "").toLowerCase().includes(term) ||
    (u.email || "").toLowerCase().includes(term)
  );
  $("modalUserList").innerHTML = list.map(userButton).join("") ||
    `<div class="muted" style="padding:15px">No classmates found.</div>`;
  $("modalUserList").querySelectorAll("[data-uid]").forEach(btn =>
    btn.onclick = () => { selectUser(allUsers.find(u => u.uid === btn.dataset.uid)); closeModal("newChatModal"); }
  );
}
function userButton(u) {
  return `<button class="user-item ${selectedUser?.uid === u.uid ? "selected":""}" data-uid="${escapeAttr(u.uid)}">
    <div class="avatar">${escapeHtml(initials(u.displayName || u.email))}</div>
    <div class="user-info"><strong>${escapeHtml(u.displayName || "Classmate")}</strong><span>${escapeHtml(u.email || "")}</span></div>
  </button>`;
}

function selectUser(user) {
  if (!user) return;
  selectedUser = user;
  $("emptyState").classList.add("hidden");
  $("conversation").classList.remove("hidden");
  $("chatName").textContent = user.displayName || "Classmate";
  $("chatEmail").textContent = user.email || "";
  $("chatAvatar").textContent = initials(user.displayName || user.email);
  renderUsers($("searchUsers").value);
  listenMessages();
  $("messageInput").focus();
}
function listenMessages() {
  if (unsubscribeMessages) unsubscribeMessages();
  const chatId = chatIdFor(currentUser.uid, selectedUser.uid);
  const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
  unsubscribeMessages = onSnapshot(q, snap => {
    $("messages").innerHTML = "";
    snap.docs.forEach(d => {
      const m = d.data();
      const mine = m.senderId === currentUser.uid;
      const time = m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString([], {hour:"2-digit", minute:"2-digit"}) : "...";
      $("messages").insertAdjacentHTML("beforeend",
        `<div class="message-row ${mine ? "mine":""}">
          <div class="bubble"><p>${escapeHtml(m.text)}</p><span class="time">${time}</span></div>
        </div>`);
    });
    const box = $("messages"); box.scrollTop = box.scrollHeight;
  }, err => showToast(friendlyError(err)));
}

function openProfile() {
  $("profileName").textContent = currentUser.displayName || "Profile";
  $("profileEmail").textContent = currentUser.email || "";
  $("profileAvatar").textContent = initials(currentUser.displayName || currentUser.email);
  $("editName").value = currentUser.displayName || "";
  $("profileMessage").textContent = "";
  openModal("profileModal");
}
function openModal(id) { $(id).classList.remove("hidden"); }
function closeModal(id) { $(id).classList.add("hidden"); }
function escapeHtml(v="") {
  return v.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
function escapeAttr(v="") { return escapeHtml(v); }

if (!configured) {
  setAuthMessage("Setup required: add your Firebase web configuration to script.js.");
}

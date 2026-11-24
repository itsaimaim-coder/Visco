import { api, showStatus, setBusy } from "./shared.js";

const form = document.querySelector("#login-form");
if (form) initLogin(form);

function initLogin(root) {
  const status = document.querySelector("#login-status");
  const submit = document.querySelector("#login-button");
  const username = document.querySelector("#username");
  const password = document.querySelector("#password");

  root.addEventListener("submit", async (event) => {
    event.preventDefault();
    showStatus(status, "");

    const user = username.value.trim();
    if (!user || !password.value) {
      showStatus(status, "Isi nama pengguna dan kata sandi.", "error");
      if (!user) {
        username.focus();
      } else {
        password.focus();
      }
      return;
    }

    setBusy(submit, true, "Memeriksa...");

    try {
      await api("/api/login", {
        method: "POST",
        body: JSON.stringify({
          username: user,
          password: password.value
        })
      });
      window.location.replace("/dashboard");
    } catch (error) {
      showStatus(status, error.message, "error");
      password.value = "";
      password.focus();
    } finally {
      setBusy(submit, false);
    }
  });
}

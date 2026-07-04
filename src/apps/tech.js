export function initTechApp({
  clientIdEl,
  saveConfigBtn,
  loginBtn,
  logoutBtn,
  titleEl,
  contentEl,
  saveBtn,
  loadBtn,
  onSaveConfig,
  onLogin,
  onLogout,
  onSaveData,
  onLoadData
}) {
  if (clientIdEl?.value == null) {
    // no-op
  }

  saveConfigBtn.addEventListener("click", onSaveConfig);
  loginBtn.addEventListener("click", onLogin);
  logoutBtn.addEventListener("click", onLogout);

  saveBtn.addEventListener("click", onSaveData);
  loadBtn.addEventListener("click", onLoadData);

  if (titleEl?.value == null || contentEl?.value == null) {
    // no-op
  }
}

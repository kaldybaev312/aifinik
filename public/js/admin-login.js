const email = document.getElementById("email");
const password = document.getElementById("password");
const btn = document.getElementById("btnLogin");
const err = document.getElementById("err");

function showErr(msg){
  err.textContent = msg || "Ошибка";
  err.classList.remove("hidden");
}
function clearErr(){
  err.textContent = "";
  err.classList.add("hidden");
}

btn.addEventListener("click", async () => {
  clearErr();
  const payload = {
    email: email.value.trim(),
    password: password.value
  };
  if (!payload.email || !payload.password) return showErr("Введите email и пароль.");

  try{
    const res = await fetch("/api/auth/login",{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(()=>({}));
    if(!res.ok || !data.ok) throw new Error(data.message || "Login error");

    localStorage.setItem("aifinik_admin_token", data.token);
    window.location.href = "/admin/dashboard.html";
  }catch(e){
    showErr(e.message);
  }
});
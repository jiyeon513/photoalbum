const SCROLL_AMOUNT = 130;

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetId = btn.dataset.target;
    const row = document.getElementById(targetId);
    if (!row) return;

    const direction = btn.classList.contains("next") ? 1 : -1;
    row.scrollBy({ left: SCROLL_AMOUNT * direction, behavior: "smooth" });
  });
});

document.querySelector(".fab").addEventListener("click", () => {
  alert("Add Books 기능은 준비 중입니다.");
});

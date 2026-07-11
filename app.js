document.querySelectorAll(".book-cover, .envelope-cover").forEach((btn) => {
  btn.addEventListener("click", () => {
    const title =
      btn.querySelector(".book-title")?.textContent ??
      btn.querySelector(".envelope-title")?.textContent ??
      "앨범";
    console.log(`"${title}" 앨범을 엽니다.`);
  });
});
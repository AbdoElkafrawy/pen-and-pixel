const titleInput = document.getElementById("title");
const titleCounter = document.getElementById("title-counter");

const contentInput = document.getElementById("content");
const contentCounter = document.getElementById("content-counter");

function setupCounter(input, counter, maxLength, warningLimit, dangerLimit) {

    if (!input || !counter) {
        return;
    }
    
    function updateCounter() {
    const length = input.value.length;
            counter.textContent = `${length} / ${maxLength}`;
            counter.classList.remove("warning", "danger");
            if (length >= dangerLimit) {
            counter.classList.add("danger");
            } else if (length >= warningLimit) {
            counter.classList.add("warning");
            }

}
    input.addEventListener("input", updateCounter);
       
    
    updateCounter();
}

setupCounter(titleInput, titleCounter, 100, 80, 95);

setupCounter(contentInput, contentCounter, 5000, 4000, 4750);











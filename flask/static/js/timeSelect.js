const timeSelect = document.getElementById('timeSelect');
const selectedRange = document.getElementById('selectedRange');

let lastClickedIndex = null;

timeSelect.addEventListener('change', (e) => {
    const options = Array.from(timeSelect.options);
    const selectedIndexes = options
        .map((o, i) => o.selected ? i : -1)
        .filter(i => i !== -1);

    if (selectedIndexes.length === 0) {
        selectedRange.textContent = '';
        lastClickedIndex = null;
        return;
    }

    const currentIndex = selectedIndexes[selectedIndexes.length - 1];

    if (e.shiftKey && lastClickedIndex !== null) {
        const minIndex = Math.min(lastClickedIndex, currentIndex);
        const maxIndex = Math.max(lastClickedIndex, currentIndex);
        for (let i = minIndex; i <= maxIndex; i++) {
            options[i].selected = true;
        }
    }

    lastClickedIndex = currentIndex;

    // Display selected range
    const finalSelected = Array.from(options).filter(o => o.selected);
    selectedRange.textContent = `Selected: ${finalSelected[0].text} – ${finalSelected[finalSelected.length - 1].text}`;
});

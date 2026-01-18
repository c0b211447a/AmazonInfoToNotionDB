document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveBtn').addEventListener('click', saveOptions);

function saveOptions() {
  const notionToken = document.getElementById('notionToken').value;
  const dbId = document.getElementById('dbId').value;

  chrome.storage.local.set(
    { notionToken: notionToken, dbId: dbId },
    () => {
      // Update status to let user know options were saved.
      const status = document.getElementById('status');
      status.textContent = 'Options saved.';
      setTimeout(() => {
        status.textContent = '';
      }, 2000);
    }
  );
}

function restoreOptions() {
  chrome.storage.local.get(
    { notionToken: '', dbId: '' },
    (items) => {
      document.getElementById('notionToken').value = items.notionToken;
      document.getElementById('dbId').value = items.dbId;
    }
  );
}

document.addEventListener('DOMContentLoaded', () => {
    const snippetsList = document.getElementById('snippetsList');
    const newSnippetBtn = document.getElementById('newSnippetBtn');
    const snippetName = document.getElementById('snippetName');
    const snippetContent = document.getElementById('snippetContent');
    const saveBtn = document.getElementById('saveBtn');
    const discardBtn = document.getElementById('discardBtn');
    const gitTracking = document.getElementById('gitTracking');
    const historyPanel = document.getElementById('historyPanel');
    const historyList = document.getElementById('historyList');
    const closeHistoryBtn = document.querySelector('.close-history-btn');
    const editorTitle = document.querySelector('.editor-title');
    const saveMessage = document.getElementById('saveMessage');

    let currentSnippet = null;
    let snippets = {};
    let isShowingHistory = false;  // Add flag to prevent recursion
    let saveMessageTimeout;  // Add timeout variable for save message

    // Make functions globally accessible
    window.showHistory = async function(snippetId) {
        // Prevent recursive calls
        if (isShowingHistory) {
            return;
        }
        isShowingHistory = true;

        try {
            // Select the snippet first
            selectSnippet(snippetId, snippets[snippetId].name, true);  // Pass true to indicate history is being shown
            
            const response = await fetch(`/api/snippets/${snippetId}/history`);
            const history = await response.json();
            
            // Get snippet name
            const snippetName = snippets[snippetId]?.name || 'Unknown Snippet';
            
            // Update history panel header
            const historyHeader = document.querySelector('.history-header h3');
            if (historyHeader) {
                historyHeader.textContent = snippetName;
            }
            
            historyList.innerHTML = '';
            
            for (const commit of history) {
                const li = document.createElement('li');
                li.className = 'history-item';
                
                const commitInfo = document.createElement('div');
                commitInfo.className = 'commit-info';
                commitInfo.innerHTML = `
                    <div class="commit-header">
                        <div class="commit-date">${new Date(commit.date).toLocaleString()}</div>
                        <div class="commit-actions">
                            <button class="restore-btn" title="Restore this version">
                                <i class="fas fa-undo"></i>
                            </button>
                            <button class="toggle-diff-btn">
                                <i class="fas fa-chevron-down"></i>
                            </button>
                        </div>
                    </div>
                `;
                
                const diffContainer = document.createElement('div');
                diffContainer.className = 'diff-container';
                diffContainer.style.display = 'none';
                
                // Fetch and format the diff
                const diffResponse = await fetch(`/api/snippets/${snippetId}/diff/${commit.hash}`);
                const diffData = await diffResponse.json();
                
                if (diffData.diff) {
                    const diffLines = diffData.diff.split('\n');
                    let inHunk = false;
                    let currentHunk = [];
                    
                    diffLines.forEach(line => {
                        // Skip diff headers and file names
                        if (line.startsWith('diff --git') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) {
                            return;
                        }
                        
                        // Start of a new hunk
                        if (line.startsWith('@')) {
                            if (currentHunk.length > 0) {
                                // Add the previous hunk to the container
                                const hunkDiv = document.createElement('div');
                                hunkDiv.className = 'diff-hunk';
                                currentHunk.forEach(diffLine => hunkDiv.appendChild(diffLine));
                                diffContainer.appendChild(hunkDiv);
                                currentHunk = [];
                            }
                            inHunk = true;
                            return;
                        }
                        
                        if (inHunk) {
                            const diffLine = document.createElement('div');
                            diffLine.className = 'diff-line';
                            
                            if (line.startsWith('+')) {
                                diffLine.className += ' added';
                                diffLine.textContent = line; // Keep the + prefix
                            } else if (line.startsWith('-')) {
                                diffLine.className += ' removed';
                                diffLine.textContent = line; // Keep the - prefix
                            } else if (line.trim() === '') {
                                diffLine.className += ' empty';
                                diffLine.textContent = ' ';
                            } else {
                                diffLine.className += ' context';
                                diffLine.textContent = line; // Keep the space prefix
                            }
                            
                            currentHunk.push(diffLine);
                        }
                    });
                    
                    // Add the last hunk if there is one
                    if (currentHunk.length > 0) {
                        const hunkDiv = document.createElement('div');
                        hunkDiv.className = 'diff-hunk';
                        currentHunk.forEach(diffLine => hunkDiv.appendChild(diffLine));
                        diffContainer.appendChild(hunkDiv);
                    }
                }
                
                // Add click handler for the entire history item
                li.addEventListener('click', (e) => {
                    // Don't toggle if clicking the delete button
                    if (e.target.closest('.delete-btn')) {
                        return;
                    }
                    
                    // Close all other diff containers
                    document.querySelectorAll('.diff-container').forEach(container => {
                        if (container !== diffContainer) {
                            container.style.display = 'none';
                            const btn = container.previousElementSibling.querySelector('.toggle-diff-btn');
                            if (btn) {
                                btn.querySelector('i').className = 'fas fa-chevron-down';
                            }
                        }
                    });
                    
                    // Toggle the clicked container
                    const isExpanded = diffContainer.style.display === 'block';
                    diffContainer.style.display = isExpanded ? 'none' : 'block';
                    const toggleBtn = commitInfo.querySelector('.toggle-diff-btn');
                    toggleBtn.querySelector('i').className = isExpanded ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
                });
                
                // Add click handler for toggle button
                const toggleBtn = commitInfo.querySelector('.toggle-diff-btn');
                toggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isExpanded = diffContainer.style.display === 'block';
                    diffContainer.style.display = isExpanded ? 'none' : 'block';
                    toggleBtn.querySelector('i').className = isExpanded ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
                });

                // Add restore functionality
                const restoreBtn = commitInfo.querySelector('.restore-btn');
                restoreBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (confirm('Are you sure you want to restore this version? This will replace your current content.')) {
                        try {
                            const response = await fetch(`/api/snippets/${snippetId}`, {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    content: commit.content,
                                    name: currentSnippet
                                })
                            });
                            
                            if (response.ok) {
                                const data = await response.json();
                                snippetContent.value = data.content;
                                showSaveMessage('Version restored successfully!', 'success');
                                loadSnippets(); // Refresh the list to update timestamps
                            } else {
                                const error = await response.json();
                                showSaveMessage(error.error || 'Failed to restore version', 'error');
                            }
                        } catch (error) {
                            showSaveMessage('Failed to restore version', 'error');
                        }
                    }
                });
                
                li.appendChild(commitInfo);
                li.appendChild(diffContainer);
                historyList.appendChild(li);
            }
            
            // Open the most recent history item by default
            const firstDiffContainer = historyList.querySelector('.diff-container');
            const firstToggleBtn = historyList.querySelector('.toggle-diff-btn');
            if (firstDiffContainer && firstToggleBtn) {
                firstDiffContainer.style.display = 'block';
                firstToggleBtn.querySelector('i').className = 'fas fa-chevron-up';
            }
            
            historyPanel.classList.add('visible');
        } catch (error) {
            console.error('Error loading history:', error);
            alert('Error loading snippet history');
        } finally {
            isShowingHistory = false;  // Reset the flag
        }
    };

    window.deleteSnippet = async function(id) {
        if (!confirm(`Are you sure you want to delete "${id}"?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/snippets/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const error = await response.json();
                alert(error.error || 'Error deleting snippet');
                return;
            }

            // Close history panel
            historyPanel.classList.remove('visible');

            // If the deleted snippet was the current one, select another snippet
            if (currentSnippet === id) {
                currentSnippet = null;
                snippetName.value = '';
                snippetContent.value = '';
                gitTracking.checked = false;
                updateActiveSnippet(null);

                // Find another snippet to select
                const remainingSnippets = Object.entries(snippets).filter(([sid]) => sid !== id);
                if (remainingSnippets.length > 0) {
                    // Select the first remaining snippet
                    const [nextId, nextSnippet] = remainingSnippets[0];
                    selectSnippet(nextId, nextSnippet.name);
                    
                    // Update the UI to show the selected snippet
                    document.querySelectorAll('.snippet-item').forEach(item => {
                        item.classList.remove('active', 'selected');
                    });
                    const selectedItem = document.querySelector(`.snippet-item[data-id="${nextId}"]`);
                    if (selectedItem) {
                        selectedItem.classList.add('active', 'selected');
                        selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                }
            }

            await loadSnippets();
        } catch (error) {
            console.error('Error deleting snippet:', error);
            alert('Error deleting snippet');
        }
    };

    // Load Git status for a snippet
    async function loadGitStatus(snippetId) {
        try {
            const response = await fetch(`/api/snippets/${snippetId}/git-status`);
            if (!response.ok) {
                throw new Error('Failed to load Git status');
            }
            const data = await response.json();
            const gitTrackingCheckbox = document.getElementById('gitTracking');
            if (gitTrackingCheckbox) {
                gitTrackingCheckbox.checked = data.tracked;
            }
        } catch (error) {
            console.error('Error loading Git status:', error);
        }
    }

    // Load snippets from the server
    function loadSnippets() {
        fetch('/api/snippets')
            .then(response => response.json())
            .then(data => {
                console.log('Received snippets data:', data);
                snippets = data;
                const snippetsList = document.getElementById('snippetsList');
                if (!snippetsList) {
                    console.error('Snippets list element not found');
                    return;
                }
                snippetsList.innerHTML = '';
                
                Object.entries(snippets).forEach(([id, snippet]) => {
                    console.log('Processing snippet:', id, snippet);
                    const div = document.createElement('div');
                    div.className = 'snippet-item';
                    div.setAttribute('data-id', id);
                    
                    // Check if snippet has Git tracking enabled
                    const hasGitTracking = snippet.git_tracking === true;
                    console.log('Git tracking status for', id, ':', hasGitTracking);
                    
                    div.innerHTML = `
                        <div class="snippet-icon">
                            ${hasGitTracking ? 
                                `<i class="fas fa-sticky-note" title="Git Tracking Enabled">
                                    <i class="fab fa-git-alt"></i>
                                </i>` : 
                                `<i class="fas fa-sticky-note" title="Local Snippet"></i>`
                            }
                        </div>
                        <div class="snippet-info">
                            <span class="snippet-name">${snippet.name}</span>
                            <span class="snippet-timestamp">${snippet.last_modified ? new Date(snippet.last_modified).toLocaleString() : 'Never'}</span>
                        </div>
                        <div class="snippet-actions">
                            <button class="delete-btn" onclick="event.stopPropagation(); deleteSnippet('${id}')" title="Delete Snippet">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    `;
                    div.onclick = () => handleSnippetClick(id, snippet.name);
                    snippetsList.appendChild(div);
                });
            })
            .catch(error => {
                console.error('Error loading snippets:', error);
                alert('Error loading snippets');
            });
    }

    // Update active snippet and load its content
    async function updateActiveSnippet(id) {
        console.log('Updating active snippet:', id);
        
        // Remove active class from all snippets
        document.querySelectorAll('.snippet-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // If no snippet is selected (creating new), clear the editor
        if (!id) {
            currentSnippet = null;
            if (editorTitle) {
                editorTitle.textContent = 'New Snippet';
            }
            return;
        }
        
        // Add active class to selected snippet
        const selectedItem = document.querySelector(`.snippet-item[data-id="${id}"]`);
        if (selectedItem) {
            selectedItem.classList.add('active');
        } else {
            console.warn('Selected item not found in DOM:', id);
        }
        
        // Update current snippet ID
        currentSnippet = id;
        
        // Update editor title if element exists
        if (editorTitle) {
            const snippetName = selectedItem?.querySelector('span')?.textContent || '';
            editorTitle.textContent = snippetName;
        }
        
        // Load snippet content
        try {
            console.log('Fetching snippet:', id);
            const response = await fetch(`/api/snippets/${id}`);
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Error response:', errorData);
                throw new Error(errorData.error || 'Failed to load snippet');
            }
            
            const data = await response.json();
            console.log('Snippet data:', data);
            
            snippetContent.value = data.content;
            
            // Check Git tracking status
            try {
                const gitStatusResponse = await fetch(`/api/snippets/${id}/git-status`);
                if (gitStatusResponse.ok) {
                    const gitStatus = await gitStatusResponse.json();
                    gitTracking.checked = gitStatus.tracked;
                }
            } catch (gitError) {
                console.error('Error checking Git status:', gitError);
            }
        } catch (error) {
            console.error('Error loading snippet:', error);
            alert(`Error loading snippet: ${error.message}`);
        }
    }

    // Create a new snippet
    async function createSnippet() {
        console.log('Creating new snippet');
        
        // Clear current snippet
        currentSnippet = null;
        
        // Clear and focus the name field
        if (snippetName) {
            snippetName.value = '';
            snippetName.focus();
            snippetName.classList.add('active');
            snippetName.removeAttribute('readonly');
            snippetName.removeAttribute('disabled');
            console.log('Name field initialized');
        } else {
            console.error('Snippet name input not found');
        }
        
        // Clear content and Git tracking
        if (snippetContent) {
            snippetContent.value = '';
        }
        if (gitTracking) {
            gitTracking.checked = false;
            gitTracking.parentElement.style.display = 'flex'; // Show tracking checkbox for new snippets
        }
        
        // Update UI state
        updateActiveSnippet(null);
        
        // Update editor title
        if (editorTitle) {
            editorTitle.textContent = 'New Snippet';
        }
    }

    // Save the current snippet
    async function saveSnippet() {
        const name = snippetName.value.trim();
        console.log('Saving snippet with name:', name);
        
        if (!name) {
            alert('Please enter a name for the snippet');
            if (snippetName) {
                snippetName.focus();
            }
            return;
        }

        try {
            const method = currentSnippet ? 'PUT' : 'POST';
            const url = currentSnippet ? `/api/snippets/${currentSnippet}` : '/api/snippets';
            
            console.log('Saving snippet:', {
                method,
                url,
                currentSnippet,
                newName: name,
                content: snippetContent.value,
                gitTracking: gitTracking.checked
            });
            
            const requestData = {
                name: name,
                content: snippetContent.value,
                git_tracking: gitTracking.checked
            };
            
            console.log('Request data:', requestData);
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save snippet');
            }
            
            const data = await response.json();
            console.log('Save response:', data);
            
            // Update current snippet ID with the one from the server
            currentSnippet = data.id;
            
            // Update the snippets object with the new data
            snippets[currentSnippet] = {
                name: data.name,
                content: data.content,
                git_tracking: data.git_tracking
            };
            
            // Reload the snippets list to update the UI
            loadSnippets();
            
            // Update the editor title
            if (editorTitle) {
                editorTitle.textContent = data.name;
            }
            
            // Make the name field readonly after saving
            if (snippetName) {
                snippetName.setAttribute('readonly', true);
                snippetName.classList.remove('active');
            }

            // Show save success message
            clearTimeout(saveMessageTimeout);
            saveMessage.innerHTML = '<i class="fas fa-check"></i> Snippet saved successfully';
            saveMessage.classList.add('visible');
            
            // Hide the message after 2 seconds
            saveMessageTimeout = setTimeout(() => {
                saveMessage.classList.remove('visible');
            }, 2000);

            // If Git tracking is enabled, show history
            if (data.git_tracking) {
                showHistory(currentSnippet);
            } else {
                historyPanel.classList.remove('visible');
            }
        } catch (error) {
            console.error('Error saving snippet:', error);
            alert(`Error saving snippet: ${error.message}`);
        }
    }

    // Discard changes
    function discardChanges() {
        if (currentSnippet) {
            // Get the most recently saved content from the snippets object
            const savedSnippet = snippets[currentSnippet];
            if (savedSnippet) {
                // Revert content to saved state
                snippetContent.value = savedSnippet.content;
                snippetName.value = savedSnippet.name;
                
                // Update Git tracking checkbox
                if (gitTracking) {
                    gitTracking.checked = savedSnippet.git_tracking;
                }
                
                // Show discard success message
                clearTimeout(saveMessageTimeout);
                saveMessage.innerHTML = '<i class="fas fa-undo"></i> Changes discarded';
                saveMessage.classList.add('visible');
                
                // Hide the message after 2 seconds
                saveMessageTimeout = setTimeout(() => {
                    saveMessage.classList.remove('visible');
                }, 2000);
            }
        } else {
            // If no snippet is selected, create a new one
            createSnippet();
        }
    }

    // Event listeners
    newSnippetBtn.addEventListener('click', createSnippet);
    saveBtn.addEventListener('click', saveSnippet);
    discardBtn.addEventListener('click', discardChanges);
    closeHistoryBtn.addEventListener('click', () => {
        historyPanel.classList.remove('visible');
    });

    // Improve snippet selection reliability
    function selectSnippet(snippetId, name, isHistoryCall = false) {
        // Remove active class from all snippets
        document.querySelectorAll('.snippet-item').forEach(item => {
            item.classList.remove('active', 'selected');
        });
        
        // Add active class to selected snippet
        const selectedItem = document.querySelector(`.snippet-item[data-id="${snippetId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('active', 'selected');
            
            // Ensure the selected item is visible in the list
            selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        
        // Update editor state
        currentSnippet = snippetId;
        if (snippetName) {
            snippetName.value = name;
            snippetName.removeAttribute('readonly');
            snippetName.removeAttribute('disabled');
        }
        snippetContent.value = snippets[snippetId].content;
        
        // Hide tracking checkbox for existing snippets
        if (gitTracking) {
            gitTracking.parentElement.style.display = 'none';
        }
        
        // Check if the snippet has Git tracking enabled
        const hasGitTracking = snippets[snippetId]?.git_tracking === true;
        
        // Show history immediately if tracking is enabled and this isn't a history call
        if (hasGitTracking && !isHistoryCall) {
            showHistory(snippetId);
        } else if (!hasGitTracking) {
            historyPanel.classList.remove('visible');
        }
        
        // Load Git status for UI updates
        loadGitStatus(snippetId);
    }

    // Add debounce to snippet selection to prevent multiple rapid clicks
    let selectionTimeout;
    function handleSnippetClick(snippetId, name) {
        clearTimeout(selectionTimeout);
        selectionTimeout = setTimeout(() => {
            selectSnippet(snippetId, name);
        }, 100);
    }

    // Initial load
    loadSnippets();
});
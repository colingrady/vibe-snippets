document.addEventListener('DOMContentLoaded', () => {
    const snippetsList = document.querySelector('.snippets-list');
    const editorTitle = document.querySelector('.editor-title');
    const snippetContent = document.getElementById('snippetContent');
    const saveBtn = document.querySelector('.save-btn');
    const discardBtn = document.querySelector('.discard-btn');
    const gitTracking = document.getElementById('gitTracking');
    const historyPanel = document.querySelector('.history-panel');
    const historyList = document.querySelector('.history-list');
    const closeHistoryBtn = document.querySelector('.close-history-btn');
    const saveMessage = document.querySelector('.save-message');

    let currentSnippet = null;
    let snippets = {};
    let isShowingHistory = false;
    let saveMessageTimeout;

    // Theme management
    const themeToggle = document.querySelector('.theme-toggle');
    const themeIcon = themeToggle.querySelector('i');

    // Initialize theme from localStorage or system preference
    function initializeTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            document.body.setAttribute('data-theme', savedTheme);
            updateThemeIcon(savedTheme);
        } else {
            // Check system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const defaultTheme = prefersDark ? 'dark' : 'light';
            document.body.setAttribute('data-theme', defaultTheme);
            updateThemeIcon(defaultTheme);
        }
    }

    function updateThemeIcon(theme) {
        themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            const newTheme = e.matches ? 'dark' : 'light';
            document.body.setAttribute('data-theme', newTheme);
            updateThemeIcon(newTheme);
        }
    });

    // Initialize theme when the page loads
    initializeTheme();

    // Load snippets from the server
    async function loadSnippets() {
        try {
            const response = await fetch('/api/snippets');
            if (!response.ok) {
                throw new Error('Failed to load snippets');
            }
            const snippetsData = await response.json();
            console.log('Loaded snippets:', snippetsData);
            
            // Convert object to array and sort by date
            const snippetsArray = Object.entries(snippetsData).map(([id, data]) => ({
                id,
                ...data
            })).sort((a, b) => new Date(b.last_modified) - new Date(a.last_modified));
            
            // Update the snippets object
            snippets = snippetsData;
            
            // Clear the snippets list
            snippetsList.innerHTML = '';
            
            // Add the empty snippet at the top
            const emptySnippet = document.createElement('div');
            emptySnippet.className = 'snippet-item empty-snippet';
            emptySnippet.innerHTML = `
                <div class="snippet-icon">
                    <i class="fas fa-plus"></i>
                </div>
                <div class="snippet-info">
                    <div class="snippet-name">New Snippet</div>
                </div>
            `;
            emptySnippet.onclick = createSnippet;
            snippetsList.appendChild(emptySnippet);
            
            // Add existing snippets
            snippetsArray.forEach(snippet => {
                console.log('Processing snippet:', snippet);
                const div = document.createElement('div');
                div.className = 'snippet-item';
                div.dataset.id = snippet.id;
                
                const hasGitTracking = snippet.git_tracking;
                console.log('Snippet timestamp:', snippet.last_modified);
                
                div.innerHTML = `
                    <div class="snippet-icon">
                        ${hasGitTracking ? 
                            `<i class="fas fa-sticky-note" title="History Tracking Enabled">
                                <i class="fab fa-git-alt"></i>
                            </i>` : 
                            `<i class="fas fa-sticky-note" title="Local Snippet"></i>`
                        }
                    </div>
                    <div class="snippet-info">
                        <div class="snippet-name">${snippet.name}</div>
                        <div class="snippet-timestamp">${snippet.last_modified ? new Date(snippet.last_modified).toLocaleString() : ''}</div>
                    </div>
                    <div class="snippet-actions">
                        <button class="delete-btn" onclick="event.stopPropagation(); deleteSnippet('${snippet.id}')" title="Delete Snippet">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
                
                div.onclick = () => selectSnippet(snippet.id);
                snippetsList.appendChild(div);
            });
            
            // If we have a current snippet, ensure it's selected
            if (currentSnippet && snippets[currentSnippet]) {
                selectSnippet(currentSnippet);
            }
        } catch (error) {
            console.error('Error loading snippets:', error);
            alert('Failed to load snippets');
        }
    }

    // Make createSnippet globally accessible
    window.createSnippet = function() {
        console.log('Creating new snippet');
        
        // Clear current snippet
        currentSnippet = null;
        
        // Close history panel
        historyPanel.classList.remove('visible');
        
        // Clear and focus the name field
        if (editorTitle) {
            editorTitle.value = '';
            editorTitle.focus();
            editorTitle.classList.add('active');
            editorTitle.removeAttribute('readonly');
            editorTitle.removeAttribute('disabled');
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
            editorTitle.value = 'New Snippet';
        }
    };

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
                            const response = await fetch(`/api/snippets/${snippetId}/history/${commit.hash}`);
                            if (!response.ok) {
                                throw new Error('Failed to load version');
                            }
                            const data = await response.json();
                            
                            // Update editor content without saving
                            if (snippetContent) {
                                snippetContent.value = data.content;
                            }
                            
                            // Show success message
                            showSaveMessage('Version restored to editor', 'success');
                        } catch (error) {
                            console.error('Error restoring version:', error);
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

    // Make deleteSnippet globally accessible
    window.deleteSnippet = async function(snippetId) {
        event.stopPropagation();
        
        const snippet = snippets[snippetId];
        if (!snippet) return;
        
        if (confirm(`Are you sure you want to delete "${snippet.name}"?`)) {
            try {
                const response = await fetch(`/api/snippets/${snippetId}`, {
                    method: 'DELETE'
                });
                
                if (!response.ok) {
                    throw new Error('Failed to delete snippet');
                }
                
                // Close history panel if it's open
                historyPanel.classList.remove('visible');
                
                // If this was the current snippet, select another one
                if (currentSnippet === snippetId) {
                    const remainingSnippets = Object.keys(snippets).filter(id => id !== snippetId);
                    if (remainingSnippets.length > 0) {
                        selectSnippet(remainingSnippets[0]);
                    } else {
                        // If no snippets remain, create a new one
                        createSnippet();
                    }
                }
                
                // Remove the snippet from our local state
                delete snippets[snippetId];
                
                // Reload the snippets list
                loadSnippets();
            } catch (error) {
                console.error('Error deleting snippet:', error);
                alert('Failed to delete snippet');
            }
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
        if (editorTitle) {
            editorTitle.textContent = name;
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

    // Save the current snippet
    async function saveSnippet() {
        const name = editorTitle.value.trim();
        console.log('Saving snippet with name:', name);
        
        if (!name) {
            alert('Please enter a name for the snippet');
            if (editorTitle) {
                editorTitle.focus();
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
                editorTitle.value = data.name;
            }
            
            // Make the name field readonly after saving
            if (editorTitle) {
                editorTitle.setAttribute('readonly', true);
                editorTitle.classList.remove('active');
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
                editorTitle.value = savedSnippet.name;
                
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
    saveBtn.addEventListener('click', saveSnippet);
    discardBtn.addEventListener('click', discardChanges);
    closeHistoryBtn.addEventListener('click', () => {
        historyPanel.classList.remove('visible');
    });

    // Initial load
    loadSnippets();
});
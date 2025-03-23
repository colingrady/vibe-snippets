import os
from git import Repo, GitCommandError
from datetime import datetime

class GitManager:
    def __init__(self, base_path):
        self.base_path = base_path
        self.repo = None
        self.initialize_repo()

    def initialize_repo(self):
        """Initialize or load the Git repository."""
        if not os.path.exists(self.base_path):
            os.makedirs(self.base_path)
        
        git_path = os.path.join(self.base_path, '.git')
        if not os.path.exists(git_path):
            self.repo = Repo.init(self.base_path)
        else:
            self.repo = Repo(self.base_path)

    def track_snippet(self, snippet_id, content):
        """Track a snippet's changes in Git."""
        snippet_path = f"{snippet_id}.txt"
        file_path = os.path.join(self.base_path, snippet_path)
        
        try:
            # Write content and create commit
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            # Check if file exists in Git
            if snippet_path in self.repo.index.entries:
                self.repo.index.add([snippet_path])
                self.repo.index.commit(f"Update snippet: {snippet_id}")
            else:
                # This is a new file, create initial commit
                self.repo.index.add([snippet_path])
                self.repo.index.commit(f"Create snippet: {snippet_id}")
            return True
        except GitCommandError as e:
            print(f"Git error: {e}")
            return False

    def get_snippet_history(self, name):
        """Get the commit history for a snippet."""
        snippet_path = f"{name}.txt"
        try:
            # Get all commits that modified this file
            commits = []
            
            # Check if file exists in working directory
            file_path = os.path.join(self.base_path, snippet_path)
            if os.path.exists(file_path):
                # Get current content
                with open(file_path, 'r', encoding='utf-8') as f:
                    current_content = f.read()
            
            # Get commit history
            for commit in self.repo.iter_commits(paths=snippet_path):
                # Get the file content at this commit
                try:
                    # Get the file content from the commit's tree
                    file_content = commit.tree[snippet_path].data_stream.read().decode('utf-8')
                except Exception as e:
                    print(f"Error getting content for commit {commit.hexsha}: {e}")
                    file_content = None
                
                commits.append({
                    'hash': commit.hexsha,
                    'message': commit.message,
                    'author': commit.author.name,
                    'date': datetime.fromtimestamp(commit.committed_datetime.timestamp()),
                    'content': file_content
                })
            
            return commits
        except GitCommandError as e:
            print(f"Git error getting history: {e}")
            return []

    def get_diff(self, name, commit_hash):
        """Get the diff for a specific commit"""
        try:
            file_path = f"{name}.txt"
            commit = self.repo.commit(commit_hash)
            
            # Check if file exists in this commit
            if file_path not in commit.tree:
                print(f"File {file_path} not found in commit {commit_hash}")
                return None
            
            # Get the diff between the commit and its parent
            try:
                if not commit.parents:
                    # This is the first commit, show the full file as added lines
                    content = commit.tree[file_path].data_stream.read().decode('utf-8')
                    return '\n'.join(f'+{line}' for line in content.split('\n'))
                
                diff = self.repo.git.diff(commit.parents[0].hexsha, commit_hash, file_path)
                if isinstance(diff, bytes):
                    return diff.decode('utf-8')
                return diff
            except GitCommandError as e:
                print(f"Git error getting diff: {e}")
                return None
        except Exception as e:
            print(f"Error getting diff: {e}")
            return None

    def is_tracked(self, name):
        """Check if a snippet is being tracked by Git."""
        snippet_path = f"{name}.txt"
        return snippet_path in self.repo.index.entries 
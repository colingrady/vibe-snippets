from sanic import Sanic
from sanic.response import html, json as json_response
from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import json
import os
from models import init_db, async_session, Snippet
from git_manager import GitManager

app = Sanic("snippets_app")

# Configure static files
app.static('/static', './static')

# Set up Jinja2 environment
env = Environment(
    loader=FileSystemLoader('templates'),
    autoescape=select_autoescape(['html', 'xml'])
)

# Initialize Git manager
git_manager = GitManager(os.path.join(os.path.dirname(__file__), 'snippets'))

@app.listener('before_server_start')
async def setup_db(app, loop):
    await init_db()

@app.route('/')
async def index(request):
    async with async_session() as session:
        result = await session.execute(select([Snippet]))
        snippets = {snippet.name: snippet.content for snippet in result.scalars()}
    template = env.get_template('index.html')
    return html(template.render(snippets=snippets))

@app.route('/api/snippets', methods=['GET'])
async def get_snippets(request):
    async with async_session() as session:
        result = await session.execute(select([Snippet]))
        snippets = {snippet.id: {
            'name': snippet.name, 
            'content': snippet.content,
            'git_tracking': snippet.git_tracking,
            'last_modified': snippet.updated_at.isoformat() if snippet.updated_at else None
        } for snippet in result.scalars()}
    return json_response(snippets)

@app.post('/api/snippets')
async def create_snippet(request):
    try:
        data = request.json
        name = data.get('name')
        content = data.get('content', '')
        git_tracking = data.get('git_tracking', False)

        if not name:
            return json_response({'error': 'Name is required'}, status=400)

        async with async_session() as session:
            # Check if snippet with this name already exists
            existing = await session.execute(
                select(Snippet).where(Snippet.name == name)
            )
            if existing.scalar_one_or_none():
                return json_response({'error': 'A snippet with this name already exists'}, status=400)

            # Create new snippet
            snippet = Snippet(
                name=name,
                content=content,
                git_tracking=git_tracking
            )
            session.add(snippet)
            await session.commit()
            await session.refresh(snippet)

            # Track in Git if enabled
            if git_tracking:
                print(f"Tracking changes in Git for new snippet: {snippet.id}")
                git_manager.track_snippet(snippet.id, content)

            return json_response(snippet.to_dict())
    except Exception as e:
        print(f"Error creating snippet: {str(e)}")
        return json_response({'error': str(e)}, status=500)

@app.route('/api/snippets/<snippet_id>', methods=['GET'])
async def get_snippet(request, snippet_id):
    """Get a single snippet by ID."""
    print(f"Getting snippet: {snippet_id}")
    async with async_session() as session:
        try:
            result = await session.execute(select([Snippet]).where(Snippet.id == snippet_id))
            snippet = result.scalar_one_or_none()
            
            print(f"Found snippet: {snippet}")
            
            if not snippet:
                print(f"Snippet not found: {snippet_id}")
                return json_response({'error': 'Snippet not found'}, status=404)
            
            response_data = {
                'id': snippet.id,
                'name': snippet.name,
                'content': snippet.content,
                'git_tracking': snippet.git_tracking,
                'last_modified': snippet.updated_at.isoformat() if snippet.updated_at else None
            }
            print(f"Returning snippet data: {response_data}")
            return json_response(response_data)
        except Exception as e:
            print(f"Error getting snippet: {e}")
            import traceback
            print(f"Traceback: {traceback.format_exc()}")
            return json_response({'error': 'Error getting snippet'}, status=500)

@app.route('/api/snippets/<snippet_id>', methods=['PUT'])
async def update_snippet(request, snippet_id):
    data = request.json
    content = data.get('content', '')
    new_name = data.get('name', '')
    
    print(f"Updating snippet: {snippet_id}")
    print(f"Request data: {data}")
    
    async with async_session() as session:
        try:
            # Get existing snippet
            result = await session.execute(select([Snippet]).where(Snippet.id == snippet_id))
            snippet = result.scalar_one_or_none()
            
            print(f"Found snippet: {snippet}")
            
            if not snippet:
                print(f"Snippet not found: {snippet_id}")
                return json_response({
                    'error': f'Snippet not found',
                    'details': 'The snippet you are trying to update does not exist'
                }, status=404)
            
            # If name is changing, check if new name exists
            if new_name and new_name != snippet.name:
                print(f"Checking if new name exists: {new_name}")
                new_name_result = await session.execute(select([Snippet]).where(Snippet.name == new_name))
                if new_name_result.scalar_one_or_none():
                    print(f"New name already exists: {new_name}")
                    return json_response({
                        'error': f'Snippet with name "{new_name}" already exists',
                        'details': 'Please choose a different name for your snippet'
                    }, status=400)
                print(f"Updating name from {snippet.name} to {new_name}")
                snippet.name = new_name
            
            # Update content
            print(f"Updating content for {snippet.name}")
            snippet.content = content
            await session.commit()
            
            # Track in Git if the snippet was created with tracking enabled
            if snippet.git_tracking:
                print(f"Tracking changes in Git for {snippet.id}")
                git_manager.track_snippet(snippet.id, content)
            
            print(f"Successfully updated snippet: {snippet.name}")
            return json_response({
                'id': snippet.id,
                'name': snippet.name,
                'content': snippet.content,
                'git_tracking': snippet.git_tracking,
                'last_modified': snippet.updated_at.isoformat() if snippet.updated_at else None
            })
        except Exception as e:
            await session.rollback()
            print(f"Error updating snippet: {e}")
            import traceback
            print(f"Traceback: {traceback.format_exc()}")
            return json_response({
                'error': 'Error updating snippet',
                'details': str(e)
            }, status=500)

@app.route('/api/snippets/<snippet_id>', methods=['DELETE'])
async def delete_snippet(request, snippet_id):
    async with async_session() as session:
        # Get existing snippet
        result = await session.execute(select([Snippet]).where(Snippet.id == snippet_id))
        snippet = result.scalar_one_or_none()
        
        if not snippet:
            return json_response({'error': 'Snippet not found'}, status=404)
        
        # Delete snippet
        await session.delete(snippet)
        await session.commit()
    
    return json_response({'success': True})

@app.route('/api/snippets/<snippet_id>/history', methods=['GET'])
async def get_snippet_history(request, snippet_id):
    async with async_session() as session:
        result = await session.execute(select([Snippet]).where(Snippet.id == snippet_id))
        snippet = result.scalar_one_or_none()
        
        if not snippet:
            return json_response({'error': 'Snippet not found'}, status=404)
        
        history = git_manager.get_snippet_history(snippet.id)
        # Convert datetime objects to ISO format strings
        serialized_history = []
        for commit in history:
            commit_data = commit.copy()
            if 'date' in commit_data:
                commit_data['date'] = commit_data['date'].isoformat()
            serialized_history.append(commit_data)
        return json_response(serialized_history)

@app.route('/api/snippets/<snippet_id>/diff/<commit_hash>', methods=['GET'])
async def get_snippet_diff(request, snippet_id, commit_hash):
    async with async_session() as session:
        result = await session.execute(select([Snippet]).where(Snippet.id == snippet_id))
        snippet = result.scalar_one_or_none()
        
        if not snippet:
            return json_response({'error': 'Snippet not found'}, status=404)
        
        diff = git_manager.get_diff(snippet.id, commit_hash)
        if diff is None:
            return json_response({'error': 'Diff not found'}, status=404)
        return json_response({'diff': diff})

@app.route('/api/snippets/<snippet_id>/git-status', methods=['GET'])
async def get_git_status(request, snippet_id):
    async with async_session() as session:
        result = await session.execute(select([Snippet]).where(Snippet.id == snippet_id))
        snippet = result.scalar_one_or_none()
        
        if not snippet:
            return json_response({'error': 'Snippet not found'}, status=404)
        
        is_tracked = git_manager.is_tracked(snippet.id)
        return json_response({'tracked': is_tracked})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True) 
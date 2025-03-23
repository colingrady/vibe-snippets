# Snippets

A modern web application for managing and versioning code snippets with Git integration.

## Features

- Create, edit, and delete code snippets
- Syntax highlighting for code
- Git-based version control for snippets
- History tracking with diff view
- Real-time updates
- Modern, responsive UI
- Local storage with SQLite database

## Prerequisites

- Python 3.8 or higher
- Git
- pip (Python package manager)

## Installation

1. Clone the repository
2. Create and activate a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

## Usage

1. Start the server:
```bash
python main.py
```

2. Open your web browser and navigate to:
```
http://localhost:8000
```

## Project Structure

```
snippets/
├── data/               # SQLite database directory
├── snippets/          # Git repository for snippet versions
├── static/            # Static files (CSS, JavaScript)
│   ├── css/
│   └── js/
├── templates/         # HTML templates
├── main.py           # Main application file
├── models.py         # Database models
├── git_manager.py    # Git integration
└── requirements.txt  # Python dependencies
```

## Development

The application is built with:
- [Sanic](https://sanic.dev/) - Fast async web framework
- [SQLAlchemy](https://www.sqlalchemy.org/) - SQL toolkit and ORM
- [GitPython](https://gitpython.readthedocs.io/) - Git integration
- [Jinja2](https://jinja.palletsprojects.com/) - Template engine

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Font Awesome](https://fontawesome.com/) for icons
- [CodeMirror](https://codemirror.net/) for code editing 
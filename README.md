# ShrekChat - Messaging Application

ShrekChat is a modern messaging application built with FastAPI as the backend and vanilla JavaScript, HTML, and CSS for the frontend. It uses Jinja2 for server-side templating.

## Features

- User authentication (login and registration)
- Messaging between contacts
- Contact list with status indicators
- Profile viewing
- Responsive design for mobile and desktop
- Dark/light theme switching
- Chat search functionality

## Project Structure

```
app/
├── routers/           # API routes
│   ├── auth.py        # Authentication routes
│   └── chat.py        # Chat-related routes
├── static/            # Static files
│   ├── css/           # CSS stylesheets
│   ├── js/            # JavaScript files
│   └── images/        # Image assets
└── templates/         # Jinja2 templates
    ├── auth/          # Authentication templates
    │   ├── login.html
    │   └── registration.html
    ├── base.html      # Base template
    └── chat.html      # Main chat template
```

## Installation

1. Clone the repository:
```
git clone <repository-url>
```

2. Create a virtual environment and activate it:
```
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate
```

3. Install the required packages:
```
pip install -r requirements.txt
```

## Running the Application

1. Start the server:
```
python main.py
```

2. Open your browser and navigate to:
```
http://localhost:8000
```

## Development

To run the server in development mode with auto-reload:

```
uvicorn main:app --reload
```

## Authentication

The application uses session-based authentication with JWT tokens. Users can register and log in with their credentials. For demonstration purposes, user data is stored in memory - in a production environment, you would use a database.

## Customization

- Modify the CSS files in `app/static/css` to customize the appearance
- Add new routes in `app/routers` to extend functionality
- Edit templates in `app/templates` to change the HTML structure

## License

This project is licensed under the MIT License - see the LICENSE file for details.
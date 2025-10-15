# Web-App-Deployment-Tool

## Starting Development
Note that this project follows along with the structure of the [Django tutorials](https://docs.djangoproject.com/en/5.2/intro/tutorial01/).

### Python + Django + other packages
You need Python. I'm using 3.13.3

Create a virtual environment for the project to install dependencies.
On my system (Ubuntu 25.04), this sequence of commands will create a virtual
environment in the directory `.venv` and activate it. Run something like
this in the root directory of the project to install the necessary dependencies:
```console
$ python -m venv .venv
$ source .venv/bin/activate
$ pip install -r requirements.txt
```

### The Database

Since the project makes use of a database, you need to install it on your system. The package `psycopg` is already in requirements.txt so it's already installed, but you need to install [PostgreSQL](https://www.postgresql.org/) itself.

In my experience, getting the database set up was a bit of a headache.
On my system, I had to do the following:
1. Access the postgresql server as user postgres:

   `$ sudo -u postgres psql`

2. In the command prompt of psql, create a user named `wadt` with permissions to login and create databases

   `# CREATE ROLE wadt LOGIN CREATEDB;`

3. Then add a password (use the one from the .env file):

   `# ALTER ROLE wadt PASSWORD '[password-here]';`

4. Create a database named `wadtdb`:

   `# CREATE DATABASE wadtdb;`

5. Make wadt user the owner of the database:

   `# ALTER DATABASE wadtdb OWNER TO wadt;`

6. Exit the psql prompt (Ctrl-D) and enter this command to restart postgresql:

   `$ sudo systemctl restart postgresql.service`

As long as you have the `.env` file, the webapp should now have access to the database. Run `python manage.py migrate` in the root directory of the project to set up the tables according to the model in the project.

The database won't have any data in it for you by default, but you can easily add some by going to the admin interface. It's at `/admin` after the project's url.

Before you try to be an admin, do [these steps](https://docs.djangoproject.com/en/5.2/intro/tutorial02/#creating-an-admin-user) to configure an admin user.

### Seeing if it works
Start the development server and then check out some urls.

`$ python manage.py runserver`

You will see a status message indicating a default URL of http://127.0.0.1:8000/

Try these out:
- http://127.0.0.1:8000/wadtapp
- http://127.0.0.1:8000/admin



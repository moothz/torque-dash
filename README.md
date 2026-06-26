<!-- PROJECT LOGO -->
<br />
<p align="left">
    <img src="imgs/logo.png" alt="Logo" width="350" height="55">
  <p align="left">
    A web application for uploading and presenting real-time diagnostic automobile data (OBD2) logged by Torque android app.
  </p>
</p>

## Fork Info (Modernized)

This repository is a modernized fork of the original torque-dash project, updated to run on modern platforms:
- **Node.js**: Updated for Node.js v20+ and v26+ compatibility.
- **Dependencies**: Upgraded Sequelize (v6), Joi (v17), Express (v4), Passport (v0.7), and other packages to current versions.
- **Security & Reliability**: Replaced native `bcrypt` with `bcryptjs` to avoid native build-essential compilation errors during installation.
- **Docker Compose**: Containerized the application and added a local database stack (PostgreSQL 16) with automated setup.
- **Environment Configuration**: Configured with a `.env` file to manage variables and external ports easily.

---

<!-- TABLE OF CONTENTS -->
## Table of Contents

* [About the Project](#about-the-project)
  * [Built With](#built-with)
* [Getting Started](#getting-started)
  * [Installation](#installation)
  * [Logging Data](#logging-data)
* [Functionality](#functionality)
* [License](#license)

<!-- ABOUT THE PROJECT -->
## About The Project

This project aims to provide a web application capable of receiving, editing and presenting OBD2 automobile data logged by the [Torque Pro](https://play.google.com/store/apps/details?id=org.prowl.torque&hl=en) android application. This provides an open source alternative to the official Torque Web Viewer.

### Built With
This project was built with the help of

* [Bootstrap](https://getbootstrap.com) - responsive frontend framework
* [JQuery](https://jquery.com) - javascript library used for DOM manipulation and Ajax
* [Node.js](https://nodejs.org) - javascript runtime
* [Express.js](https://expressjs.com) - web framework for Node.js
* [Sequelize.js](http://docs.sequelizejs.com/) - Node.js ORM for relational databases 
* [Leaflet.js](https://leafletjs.com/) - javascript library for interactive maps
* [Chart.js](https://www.chartjs.org/) - javascript charting library

<!-- GETTING STARTED -->
## Getting Started

To get started using the application, we recommend deploying it using Docker Compose.

### Installation

#### With Docker Compose (Recommended)

1. Clone or fork this repository:
```sh
git clone https://github.com/moothz/torque-dash.git
cd torque-dash
```
2. Configure your environment in `.env`. You can adjust the external port mapping (`EXTERNAL_PORT`), internal listening port (`PORT`), and database settings.
3. Start the Docker Compose stack:
```sh
docker compose up -d --build
```
4. Access the web dashboard at `http://localhost:<EXTERNAL_PORT>` (default port is `3000`).

#### Makefile Commands

A [Makefile](file:///home/moothz/torque-dash/Makefile) is provided to simplify container management and inspection:
* `make up` - Start the container stack.
* `make down` - Stop and remove the containers.
* `make restart` - Restart all services.
* `make status` - Check the status of the containers.
* `make logs` - Follow all container logs.
* `make db-status` - Query table row counts and storage details.
* `make latest-data` - View the 5 most recently uploaded diagnostic telemetry points.
* `make latest-sessions` - View the 5 most recently created logging sessions.
* `make latest-users` - View the 5 most recently registered user accounts.

#### Local Installation (Development)

1. Install modern NPM packages:
```sh
npm install
```
2. Create and configure your database connection string in a `.env` file:
```env
PORT=3000
DATABASE_URL=postgres://postgres:password@localhost:5432/torquedash
SESSION_KEYS=your-secret-key-1,your-secret-key-2
```
3. Ensure you have a local PostgreSQL instance running and matching the `DATABASE_URL` settings.
4. Run the development server:
```sh
npm run dev
```

### Logging data

To be able to log data from Torque Pro:

1. Register an account in torqueDASH.
2. In Torque Pro settings, set the user email address to the same as your registered account.
3. In Torque Pro settings, set the Webserver URL to point to the `/api/upload` endpoint of your deployment:
```
http://<your-server-ip-or-domain>:<port>/api/upload
```

<!-- Functionality -->
## Functionality

### Overview

A filterable table with a list of all logged sessions and options to edit, delete and export session data to CSV.

### Editing

Editing page for sessions with functionality for 

1. renaming
2. adding start/end locations (geocoding option)
3. copying and deleting
4. filtering number of datapoints
5. cutting out parts of the session
6. merging multiple sessions together

![](imgs/editing.gif)

### Mapview

Provides a graphical representation of the logged ride on top of a map with a heatline for selected PIDs and a line chart beneath the map for charting PID values. Also displays "live" data if watching a currently ongoing session.

![](imgs/mapview.png)

### Share

Provides options for sharing logged data.

1. Sharing with public URL - creates a public URL which provides access to a mapview of your logged sessions
2. Request forwarding - You may list other server URLs to which the data sent from Torque Pro will be further forwarded (eg. official Torque Web Viewer)

![](imgs/share.png)

<!-- LICENSE -->
## License

Distributed under the MIT License. See `LICENSE` for more information.

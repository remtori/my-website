# My website

## TODO

- [ ] Localization

- [ ] Blog page list all my project

- [ ] Project page list all of my personal work and online demo if its a web-based project

- [ ] Content manager page

- [ ] Abstract API to hook this site up to any service instead of fine tune it to `Netlify`

## Setup

- Blogs (/blogs/[id]) and Projects (/projects/[id]) are hosted in this repo at `/content`

- List of project and blogs is hosted on a `Postgresql` DB

- API (inside `/functions`) is hosted on a cloud functions service

- Files uploaded is store on a cloud service

## Folder structure

- `/src` contain all the source code for the page

- `/src/assets/` contain all the assets that will be embed via either css or html

- `/public` contain all the files that will be hosted directly

- `/functions` API / server stuff

- `/webpack` script to configure & build the page

- `/buildconfig.js` a file that contain absolute path to all the important directory as some config

## API

- Upload files

```
Request:
	method: POST
	url: /api/uploadFile
	content-type: [FILE_TYPE]
	body: [FILE_CONTENT]

Response:
	Ok: {
		ok: true,
		url: '/files/[HASH].[FILE_EXT]'
	}

	Error: {
		ok: false,
		message: i18n error key,
		error: Error message with stacktrace (dev mode only)
	}
```

- Search

```
Request:
	method: GET
	url: /api/search
	encodeURI: {
		category?: ['all', 'project', 'blog'],
		query: SEARCH_QUERY
	}

Response:
	Ok: {
		ok: true,
		result: [
			...
			{
				type: ['project', 'blog'],
				url,
				title,
				description,
				previewImg,
				author,
				date,
				tags
			}
			...
		]
	}

	Error: {
		ok: false,
		message: i18n error key,
		error: Error message with stacktrace (dev mode only)
	}


SearchQueryExample:
	query: 'blog about -javascript'
	flex-search: 'blog about'
	blacklist: [ 'javascript' ]

	query: 'maid vanilla -anal -"ugly bastard"'
	flex-search: 'main vanilla'
	blacklist: [ 'anal', 'ugly bastard' ]
```

- Upload project from repo

```

Request:
	method: POST
	url: /api/buildProject
	body: {
		id?: project id which will be display in the url, default will be the repo name
		repoURL: https://github.com/remtori/ATG,
		# Build command and public dir can be get from package.json, we can also override it below
		buildCommand?: 'npm run build',
		publicDir?: 'dist'
	}

Response:
	Ok: Redirect '/projects/logs/[id]'

	Error: {
		ok: false,
		message: i18n error key,
		error: Error message with stacktrace (dev mode only)
	}
```

## Routes

```
Routes:

	/api/**                : API endpoint as specified

	/files/*               : Hosted file endpoint, with correct content-type

	/search                : Global search across blogs and projects

	/editor                : [Auth] Online code editor for this repo

	/edit?file=[path]      : [Auth] Edit a specific in the repo

	/login                 : Login page

	/blogs                 : List of posted blogs with filter and search

	/blogs/[id]            : An html or markdown rendered page

	/projects              : List of "presentable" projects with filter and search

	/projects/build/[id]   : [Auth] An folder or single html page

	/projects/logs/[id]    : [Auth] Logs of the building process for project

	/projects/[id]         : A page that embed /projects/build/[id]

```


# My website

## TODO

- [ ] Localization

- [ ] Blog page list all my project

- [ ] Project page list all of my personal work and online demo if its a web-based project

- [ ] Content manager page

## Setup

- Blogs (/blog/[id]) and Projects (/project/[id]) are hosted in this repo at `/content`

- Using `Netlify CMS` for content editing

## Folder structure

Typical `NextJs 12` + `Netlify CMS` folder structure

## API

- Search

```
Request:
	method: GET
	url: /search
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
	url: /buildProject
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
	/search              : Global search across blogs and projects

	/blog                : List of posted blogs with filter and search

	/blog/[id]           : An html or markdown rendered page

	/project             : List of "presentable" projects with filter and search

	/project/build/[id]  : [Auth] An folder or single html page

	/project/log/[id]    : [Auth] Logs of the building process for project

	/project/[id]        : A page that embed /projects/build/[id]
```

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

function sourceToPolicy(source: string) {
	switch (source) {
		case 'Chisel':
		case 'Keros For Desktop':
		case 'Test automation':
			return 'Accessibility'
		case 'AndroidStudio':
		case 'BinSkim':
		case 'Clang':
		case 'CppCheck':
		case 'Fortify':
		case 'FxCop':
		case 'ModernCop':
		case 'PREfast':
		case 'Pylint':
		case 'Microsoft (R) Visual C# Compiler':
		case 'Semmle':
		case 'StaticDriverVerifier':
		case 'TSLint':
			return 'Security'
		default: return `General (${source})`
	}
}

const randomInt = function(min: number, max: number) { // [min, max)
	return Math.floor(Math.random() * (max - min)) + min
}

const rowsToResults = (row: [any]) => {
	const result: any = {}
	'rule ruleDesc ruleObj source issuetype uri path message snippet details build bug'.split(' ').forEach((col: string, i: number) => (result as any)[col] = row[i])

	result.policy = sourceToPolicy(result.source)

	return result
}

class Details {
	readonly message
	readonly snippet
	constructor(source, message, phyLoc) {
		const isAccessibility = sourceToPolicy(source) === 'Accessibility'
		this.message = isAccessibility ? undefined : message
		this.snippet = phyLoc
	}
	toString() {
		const snippet = this.snippet
			&& this.snippet.contextRegion
			&& this.snippet.contextRegion.snippet.text
			|| this.snippet
			&& this.snippet.region
			&& this.snippet.region.snippet
			&& this.snippet.region.snippet.text
			|| ''
		return (this.message || '') + snippet
	}
}

export function parse(file) {
	const randomInt = function(min, max) { // [min, max)
		return Math.floor(Math.random() * (max - min)) + min
	}

	const last = list => list[list.length - 1]
	const sarif = typeof file === 'string' ? JSON.parse(file) : file

	const results = [].concat(...sarif.runs.filter(run => run.results).map(run => {
		const rules = run.resources && run.resources.rules || {}
		for (const ruleId in rules) {
			const rule = rules[ruleId]
			rule.toString = () => ruleId
			rule.desc = rule && rule.fullDescription && rule.fullDescription.text || ''
		}
		
		const source = run.tool.name
		const fpath = source === 'Chisel'
			? loc0 => loc0.fullyQualifiedLogicalName
			: loc0 => loc0.resultFile && loc0.resultFile.uri
				|| loc0.physicalLocation && loc0.physicalLocation.fileLocation && loc0.physicalLocation.fileLocation.uri
				|| loc0.physicalLocation && loc0.physicalLocation.uri
				|| loc0.fullyQualifiedLogicalName
				|| ''
		const results = run.results.filter(r => r.locations).map(r => {
			const ruleObj = rules[r.ruleId]
			const severity = r.level && `${r.level[0].toUpperCase()}${r.level.slice(1)}` || '(Unknown)' // Need a non empty string for counts
			const build = ['20180509.1', '20180515.1', '20180101.1'][randomInt(0, 3)]
			const bug = randomInt(0, 2) ? randomInt(106000, 106999) : undefined

			const loc0 = r.locations[0]
			const message = r.message && r.message.text || typeof r.message === 'string' && r.message || ''
			let phyLoc =  loc0 && loc0.physicalLocation

			let analysisTarget = // Scans of binary files are often missing physicalLocation.
				r.analysisTarget
				&& r.analysisTarget.uri
				&& last(r.analysisTarget.uri.split('/'))
			
			let uri = loc0.physicalLocation
				&& loc0.physicalLocation.fileLocation
				&& loc0.physicalLocation.fileLocation.uri
				&& loc0.physicalLocation.fileLocation.uriBaseId
				&& run.originalUriBaseIds // Temp
				&& run.originalUriBaseIds[loc0.physicalLocation.fileLocation.uriBaseId] + loc0.physicalLocation.fileLocation.uri
				|| analysisTarget
				|| ''

			return [
				r.ruleId || 'No RuleId', // Lack of a ruleId is legal.
				ruleObj && ruleObj.desc,
				ruleObj || 'No RuleId', // No ruleId means no obj, so using placeholder.
				source,
				severity,
				uri,
				last(fpath(r.locations[0]).split('/')) || analysisTarget,
				message,
				phyLoc, // aka snippet
				new Details(source, message, phyLoc),
				build,
				bug,
			]
		}).map(rowsToResults)

		return results
	}))

	results.map((result, i) => result.key = i) // Key is also used by Office Fabric Selection.

	return results
}
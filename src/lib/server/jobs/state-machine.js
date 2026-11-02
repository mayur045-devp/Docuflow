/**
 * Legal job states.
 * @typedef {'uploaded' | 'parsed' | 'extracted' | 'reviewed' | 'importing' | 'imported' | 'failed'} JobState
 */

export const JOB_STATES = {
	UPLOADED: 'uploaded',
	PARSED: 'parsed',
	EXTRACTED: 'extracted',
	REVIEWED: 'reviewed',
	IMPORTING: 'importing',
	IMPORTED: 'imported',
	FAILED: 'failed'
};

const LEGAL_TRANSITIONS = {
	uploaded: ['parsed', 'failed'],
	parsed: ['extracted', 'failed'],
	extracted: ['reviewed', 'extracted', 'failed'],
	reviewed: ['reviewed', 'importing', 'failed'],
	importing: ['imported', 'reviewed', 'failed'],
	imported: [], // terminal state
	failed: ['parsed', 'extracted', 'reviewed', 'importing'] // allows retry
};

/**
 * Validates whether a state transition is permitted.
 *
 * @param {JobState} fromState
 * @param {JobState} toState
 * @returns {boolean}
 */
export function canTransition(fromState, toState) {
	if (fromState === toState) return true;
	const allowed = LEGAL_TRANSITIONS[fromState] || [];
	return allowed.includes(toState);
}

/**
 * Asserts a legal transition or throws an error.
 *
 * @param {JobState} fromState
 * @param {JobState} toState
 */
export function assertTransition(fromState, toState) {
	if (!canTransition(fromState, toState)) {
		throw new Error(`Illegal job state transition from "${fromState}" to "${toState}"`);
	}
}

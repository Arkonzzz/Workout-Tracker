// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBfVoYvGGIKufCZJ6t8fk5Htqezkekp-1s",
    authDomain: "workouttracker-ebfa9.firebaseapp.com",
    projectId: "workouttracker-ebfa9",
    storageBucket: "workouttracker-ebfa9.firebasestorage.app",
    messagingSenderId: "343807132347",
    appId: "1:343807132347:web:12fe85b7363c04852d1f9e",
    measurementId: "G-YN4CSPVDER"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const { useState, useEffect } = React;

// Workout Split Data
const WORKOUT_SPLIT = [
    { name: 'Push', exercises: ['Incline Bench Press', 'Shoulder Press', 'JM Press', 'Tricep Extension', 'Calve Raises'] },
    { name: 'Pull', exercises: ['Weighted Pullups', 'Horizontal Row', 'Bicep Curl', 'Brachialis Curl', 'Forearm Flexor'] },
    { name: 'Legs', exercises: ['Squat', 'SLDL', 'Leg Extension', 'Shoulder Abduction'] },
    { name: 'Rest', exercises: [] },
    { name: 'Upper', exercises: ['Weighted Pullups', 'Incline Bench Press', 'Shoulder Press', 'Bicep Curl', 'Tricep Extension'] },
    { name: 'Lower', exercises: ['Squat', 'SLDL', 'Leg Extension', 'Calve Raises'] },
    { name: 'Rest', exercises: [] }
];

// Main App Component
function WorkoutApp() {
    const [user, setUser] = useState(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState('');
    const [view, setView] = useState('splits');
    const [currentSplit, setCurrentSplit] = useState(null);
    const [currentDay, setCurrentDay] = useState(null);
    const [workoutData, setWorkoutData] = useState({});
    const [history, setHistory] = useState([]);
    const [expandedExercise, setExpandedExercise] = useState(null);

    // Monitor Auth State
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((currentUser) => {
            setUser(currentUser);
        });
        return unsubscribe;
    }, []);

    // Handle Auth (Sign Up / Log In)
    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (isSignUp) {
                await auth.createUserWithEmailAndPassword(email, password);
            } else {
                await auth.signInWithEmailAndPassword(email, password);
            }
            setEmail('');
            setPassword('');
        } catch (err) {
            setError(err.message);
        }
    };

    // Handle Logout
    const handleLogout = async () => {
        try {
            await auth.signOut();
            setView('splits');
            setCurrentDay(null);
            setWorkoutData({});
            setHistory([]);
        } catch (err) {
            setError(err.message);
        }
    };

    // Get suggested weight based on history
    const getSuggestedWeight = (exerciseName) => {
        const last = history.find(h => h.exercise === exerciseName);
        if (!last) return null;
        return last.reps >= 8 ? last.weight + 5 : last.weight;
    };

    // Handle exercise input changes for specific set
    const handleSetChange = (exerciseIdx, setIdx, field, value) => {
        const key = `${currentDay}-${exerciseIdx}`;
        setWorkoutData(prev => {
            const exerciseSets = prev[key] || [];
            const newSets = [...exerciseSets];
            if (!newSets[setIdx]) {
                newSets[setIdx] = { weight: '', reps: '', rir: 0, comments: '' };
            }
            newSets[setIdx] = { 
                ...newSets[setIdx], 
                [field]: field === 'weight' || field === 'reps' ? parseInt(value) || 0 : value 
            };
            return { ...prev, [key]: newSets };
        });
    };

    // Add a new set for an exercise
    const addSet = (exerciseIdx) => {
        const key = `${currentDay}-${exerciseIdx}`;
        setWorkoutData(prev => {
            const exerciseSets = prev[key] || [];
            const lastSet = exerciseSets[exerciseSets.length - 1];
            const newSet = {
                weight: lastSet?.weight || '',
                reps: lastSet?.reps || '',
                rir: lastSet?.rir || 0,
                comments: ''
            };
            return { ...prev, [key]: [...exerciseSets, newSet] };
        });
    };

    // Delete a specific set
    const deleteSet = (exerciseIdx, setIdx) => {
        const key = `${currentDay}-${exerciseIdx}`;
        setWorkoutData(prev => {
            const exerciseSets = prev[key] || [];
            const newSets = exerciseSets.filter((_, idx) => idx !== setIdx);
            if (newSets.length === 0) {
                const newData = { ...prev };
                delete newData[key];
                return newData;
            }
            return { ...prev, [key]: newSets };
        });
    };

    // Save all sets for an exercise to Firestore
    const saveExercise = async (exerciseIdx) => {
        const key = `${currentDay}-${exerciseIdx}`;
        const sets = workoutData[key];
        if (!sets || sets.length === 0) {
            setError('Please add at least one set');
            return;
        }
        if (sets.some(s => !s.weight || !s.reps)) {
            setError('Please fill weight and reps for all sets');
            return;
        }
        try {
            for (const set of sets) {
                await db.collection('workouts').add({
                    userId: user.uid,
                    exercise: currentSplit.exercises[exerciseIdx],
                    weight: set.weight,
                    reps: set.reps,
                    rir: set.rir || 0,
                    comments: set.comments || '',
                    date: new Date(),
                    dayType: currentSplit.name
                });
            }
            setWorkoutData(prev => {
                const newData = { ...prev };
                delete newData[key];
                return newData;
            });
            setError('');
        } catch (err) {
            setError('Error saving: ' + err.message);
        }
    };

    // Skip exercise entirely (don't save any sets)
    const skipExercise = (exerciseIdx) => {
        const key = `${currentDay}-${exerciseIdx}`;
        setWorkoutData(prev => {
            const newData = { ...prev };
            delete newData[key];
            return newData;
        });
    };

    // Finish workout
    const finishWorkout = () => {
        const unsaved = Object.keys(workoutData).filter(k => k.startsWith(`${currentDay}-`)).length;
        if (unsaved > 0) {
            setError(`You have ${unsaved} unsaved exercises`);
            return;
        }
        setCurrentDay(null);
        setView('splits');
    };

    // Load workout history
    const loadHistory = async () => {
        try {
            const snapshot = await db.collection('workouts')
                .where('userId', '==', user.uid)
                .orderBy('date', 'desc')
                .get();
            setHistory(snapshot.docs.map(doc => doc.data()));
            setView('history');
        } catch (err) {
            setError('Error loading history: ' + err.message);
        }
    };

    // Get unique exercises from history
    const getUniqueExercises = () => {
        const exercises = [...new Set(history.map(h => h.exercise))];
        return exercises.sort();
    };

    // Get history entries for specific exercise
    const getExerciseHistory = (exerciseName) => {
        return history.filter(h => h.exercise === exerciseName);
    };

    // LOGIN VIEW
    if (!user) {
        return React.createElement('div', { className: 'min-height' },
            React.createElement('div', { className: 'auth-card' },
                React.createElement('h1', null, 'Workout Tracker'),
                React.createElement('form', { onSubmit: handleAuth, style: { display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' } },
                    React.createElement('input', { type: 'email', placeholder: 'Email', value: email, onChange: (e) => setEmail(e.target.value), required: true }),
                    React.createElement('input', { type: 'password', placeholder: 'Password', value: password, onChange: (e) => setPassword(e.target.value), required: true }),
                    error && React.createElement('div', { className: 'error' }, error),
                    React.createElement('button', { type: 'submit', className: 'btn-primary btn-block' }, isSignUp ? 'Sign Up' : 'Log In'),
                    React.createElement('button', { type: 'button', className: 'toggle-link', onClick: () => { setIsSignUp(!isSignUp); setError(''); } }, 
                        isSignUp ? 'Already have an account? Log in' : 'Need an account? Sign up'
                    )
                )
            )
        );
    }

    // SPLITS VIEW
    if (view === 'splits') {
        return React.createElement('div', { className: 'container', style: { paddingTop: '2rem' } },
            React.createElement('div', { className: 'header' },
                React.createElement('h1', null, 'Workout Split'),
                React.createElement('div', { className: 'button-group' },
                    React.createElement('button', { className: 'btn-info', onClick: loadHistory }, 'History'),
                    React.createElement('button', { className: 'btn-danger', onClick: handleLogout }, 'Logout')
                )
            ),
            React.createElement('div', { className: 'split-grid' },
                WORKOUT_SPLIT.map((day, idx) => 
                    React.createElement('button', {
                        key: idx,
                        className: 'split-btn',
                        disabled: day.exercises.length === 0,
                        onClick: () => {
                            setCurrentSplit(day);
                            setCurrentDay(idx);
                            setView('workout');
                        }
                    }, day.name + (day.exercises.length === 0 ? ' (Rest)' : ''))
                )
            )
        );
    }

    // WORKOUT VIEW
    if (view === 'workout' && currentSplit) {
        return React.createElement('div', { className: 'container', style: { paddingTop: '1rem' } },
            React.createElement('div', { className: 'header' },
                React.createElement('h1', null, currentSplit.name),
                React.createElement('button', { className: 'btn-secondary', onClick: () => setView('splits') }, 'Back')
            ),
            error && React.createElement('div', { className: 'error' }, error),
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '2rem' } },
                currentSplit.exercises.map((exercise, exerciseIdx) => {
                    const key = `${currentDay}-${exerciseIdx}`;
                    const sets = workoutData[key] || [];
                    const suggested = getSuggestedWeight(exercise);
                    
                    return React.createElement('div', { key: exerciseIdx, className: 'exercise-card' },
                        React.createElement('h2', null, exercise),
                        
                        // Display sets
                        sets.length > 0 && React.createElement('div', { className: 'sets-container' },
                            sets.map((set, setIdx) =>
                                React.createElement('div', { key: setIdx, className: 'set-row' },
                                    React.createElement('div', { className: 'set-label' }, `SET ${setIdx + 1}`),
                                    React.createElement('div', { className: 'set-inputs' },
                                        React.createElement('div', { className: 'set-input-group' },
                                            React.createElement('label', null, 'Weight'),
                                            React.createElement('input', { 
                                                type: 'number', 
                                                value: set.weight, 
                                                onChange: (e) => handleSetChange(exerciseIdx, setIdx, 'weight', e.target.value),
                                                placeholder: 'lbs'
                                            })
                                        ),
                                        React.createElement('div', { className: 'set-input-group' },
                                            React.createElement('label', null, 'Reps'),
                                            React.createElement('input', { 
                                                type: 'number', 
                                                value: set.reps, 
                                                onChange: (e) => handleSetChange(exerciseIdx, setIdx, 'reps', e.target.value),
                                                placeholder: 'reps'
                                            })
                                        ),
                                        React.createElement('div', { className: 'set-input-group' },
                                            React.createElement('label', null, 'RIR'),
                                            React.createElement('select', { 
                                                value: set.rir, 
                                                onChange: (e) => handleSetChange(exerciseIdx, setIdx, 'rir', e.target.value)
                                            },
                                                [0, 1, 2, 3].map(i => React.createElement('option', { key: i, value: i }, i))
                                            )
                                        )
                                    ),
                                    React.createElement('button', { 
                                        className: 'btn-delete-set',
                                        onClick: () => deleteSet(exerciseIdx, setIdx),
                                        title: 'Delete set'
                                    }, '✕')
                                )
                            )
                        ),
                        
                        // Comments input
                        sets.length > 0 && React.createElement('div', { className: 'form-group' },
                            React.createElement('label', null, 'Notes (applies to all sets)'),
                            React.createElement('input', { 
                                type: 'text', 
                                value: sets[0]?.comments || '', 
                                onChange: (e) => {
                                    const newSets = sets.map((s, i) => i === 0 ? { ...s, comments: e.target.value } : s);
                                    setWorkoutData(prev => ({ ...prev, [key]: newSets }));
                                },
                                placeholder: 'How did it feel?'
                            })
                        ),
                        
                        // Add set / Actions
                        React.createElement('div', { className: 'set-actions' },
                            React.createElement('button', { 
                                className: 'btn-add-set',
                                onClick: () => addSet(exerciseIdx)
                            }, '+ Add set below'),
                            sets.length > 0 && React.createElement('div', { style: { display: 'flex', gap: '0.75rem', flex: 1 } },
                                React.createElement('button', { className: 'btn-success', onClick: () => saveExercise(exerciseIdx) }, 'Save'),
                                React.createElement('button', { className: 'btn-danger-outline', onClick: () => skipExercise(exerciseIdx) }, 'Skip')
                            )
                        )
                    );
                })
            ),
            React.createElement('button', { className: 'btn-primary finish-btn btn-block', onClick: finishWorkout }, 'Finish Workout')
        );
    }

    // HISTORY VIEW
    if (view === 'history') {
        const uniqueExercises = getUniqueExercises();
        return React.createElement('div', { className: 'container', style: { paddingTop: '1rem' } },
            React.createElement('div', { className: 'header' },
                React.createElement('h1', null, 'Workout History'),
                React.createElement('button', { className: 'btn-secondary', onClick: () => setView('splits') }, 'Back')
            ),
            history.length === 0 ? 
                React.createElement('div', { className: 'empty-state' },
                    React.createElement('div', { className: 'empty-state-icon' }, '📊'),
                    React.createElement('p', null, 'No workout history yet')
                ) :
            React.createElement('div', null,
                React.createElement('div', { style: { marginBottom: '2rem' } },
                    React.createElement('p', { style: { color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '0.75rem' } }, 
                        `Total lifts tracked: ${history.length}`
                    )
                ),
                React.createElement('div', null,
                    uniqueExercises.map((exercise, idx) => {
                        const entries = getExerciseHistory(exercise);
                        const isOpen = expandedExercise === exercise;
                        return React.createElement('div', { key: idx, className: 'exercise-section' },
                            React.createElement('div', {
                                className: `exercise-header ${isOpen ? 'open' : ''}`,
                                onClick: () => setExpandedExercise(isOpen ? null : exercise)
                            },
                                React.createElement('span', { className: 'exercise-name' }, exercise),
                                React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '1rem' } },
                                    React.createElement('span', { className: 'exercise-count' }, `${entries.length} lifts`),
                                    React.createElement('span', { className: 'expand-icon' }, '▼')
                                )
                            ),
                            isOpen && React.createElement('div', { className: 'exercise-entries' },
                                entries.map((entry, entryIdx) =>
                                    React.createElement('div', { key: entryIdx, className: 'entry-item' },
                                        React.createElement('div', { className: 'entry-details' },
                                            React.createElement('div', { className: 'entry-weight-reps' },
                                                `${entry.weight} lbs × ${entry.reps} reps @ ${entry.rir} RIR`
                                            ),
                                            React.createElement('div', { className: 'entry-meta' },
                                                new Date(entry.date.seconds * 1000).toLocaleDateString('en-US', { 
                                                    weekday: 'short', 
                                                    month: 'short', 
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })
                                            ),
                                            entry.comments && React.createElement('div', { className: 'entry-comment' },
                                                `Note: ${entry.comments}`
                                            )
                                        )
                                    )
                                )
                            )
                        );
                    })
                )
            )
        );
    }
}

// Render the app
const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(React.createElement(WorkoutApp));

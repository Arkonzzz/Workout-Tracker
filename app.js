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

    // Handle exercise input changes
    const handleExerciseChange = (idx, field, value) => {
        const key = `${currentDay}-${idx}`;
        setWorkoutData(prev => ({
            ...prev,
            [key]: { ...prev[key], [field]: field === 'weight' || field === 'reps' ? parseInt(value) || 0 : value }
        }));
    };

    // Save exercise to Firestore
    const saveExercise = async (idx) => {
        const key = `${currentDay}-${idx}`;
        const data = workoutData[key];
        if (!data?.weight || !data?.reps) {
            setError('Please enter weight and reps');
            return;
        }
        try {
            await db.collection('workouts').add({
                userId: user.uid,
                exercise: currentSplit.exercises[idx],
                weight: data.weight,
                reps: data.reps,
                rir: data.rir || 0,
                comments: data.comments || '',
                date: new Date(),
                dayType: currentSplit.name
            });
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

    // Skip exercise
    const skipExercise = (idx) => {
        const key = `${currentDay}-${idx}`;
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
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '1.5rem' } },
                currentSplit.exercises.map((exercise, idx) => {
                    const key = `${currentDay}-${idx}`;
                    const data = workoutData[key] || { weight: '', reps: '', rir: 0, comments: '' };
                    const suggested = getSuggestedWeight(exercise);
                    return React.createElement('div', { key: idx, className: 'card' },
                        React.createElement('h3', null, exercise),
                        React.createElement('div', { className: 'grid-2' },
                            React.createElement('div', { className: 'form-group' },
                                React.createElement('label', null, 'Weight (lbs)'),
                                React.createElement('input', { type: 'number', value: data.weight, onChange: (e) => handleExerciseChange(idx, 'weight', e.target.value), placeholder: suggested ? `${suggested}` : 'Weight' }),
                                suggested && !data.weight && React.createElement('div', { className: 'hint' }, `Suggested: ${suggested} lbs`)
                            ),
                            React.createElement('div', { className: 'form-group' },
                                React.createElement('label', null, 'Reps'),
                                React.createElement('input', { type: 'number', min: 6, max: 8, value: data.reps, onChange: (e) => handleExerciseChange(idx, 'reps', e.target.value), placeholder: '6-8' })
                            )
                        ),
                        React.createElement('div', { className: 'form-group' },
                            React.createElement('label', null, 'RIR'),
                            React.createElement('select', { value: data.rir, onChange: (e) => handleExerciseChange(idx, 'rir', e.target.value) },
                                [0, 1, 2, 3].map(i => React.createElement('option', { key: i, value: i }, `${i} RIR`))
                            )
                        ),
                        React.createElement('div', { className: 'form-group' },
                            React.createElement('label', null, 'Comments'),
                            React.createElement('input', { type: 'text', value: data.comments, onChange: (e) => handleExerciseChange(idx, 'comments', e.target.value), placeholder: 'How did it feel?' })
                        ),
                        React.createElement('div', { className: 'exercise-actions' },
                            React.createElement('button', { className: 'btn-success', onClick: () => saveExercise(idx) }, 'Save'),
                            React.createElement('button', { className: 'btn-secondary', onClick: () => skipExercise(idx) }, 'Skip')
                        )
                    );
                })
            ),
            React.createElement('button', { className: 'btn-primary finish-btn btn-block', onClick: finishWorkout }, 'Finish Workout')
        );
    }

    // HISTORY VIEW
    if (view === 'history') {
        return React.createElement('div', { className: 'container', style: { paddingTop: '1rem' } },
            React.createElement('div', { className: 'header' },
                React.createElement('h1', null, 'Workout History'),
                React.createElement('button', { className: 'btn-secondary', onClick: () => setView('splits') }, 'Back')
            ),
            history.length === 0 ? React.createElement('div', { className: 'empty-state' }, 'No workout history yet') :
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '0.75rem' } },
                history.map((entry, idx) =>
                    React.createElement('div', { key: idx, className: 'card' },
                        React.createElement('div', { className: 'meta' },
                            React.createElement('strong', null, entry.exercise),
                            React.createElement('span', null, new Date(entry.date.seconds * 1000).toLocaleDateString())
                        ),
                        React.createElement('p', { style: { color: '#6b7280', fontSize: '14px', margin: '0.25rem 0' } }, 
                            `${entry.weight} lbs x ${entry.reps} reps @ ${entry.rir} RIR`
                        ),
                        entry.comments && React.createElement('p', { style: { color: '#9ca3af', fontSize: '14px' } }, `Note: ${entry.comments}`)
                    )
                )
            )
        );
    }
}

// Render the app
const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(React.createElement(WorkoutApp));

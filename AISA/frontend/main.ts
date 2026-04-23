import * as w from "@waylis/core";

const command = w.createCommand({ value: "curateplaylist", label: "Curate Playlist", description: "Curate a playlist based on your mood and preferences." });

const genre_step = w.createStep({
    key: "genre",
    prompt: { type: "text", content: "What kind of music do you like?" },
    reply: { 
        bodyType: "option",
        bodyLimits: {
            options: [
                { value: "rock", label: "Rock" },
                { value: "pop", label: "Pop" },
                { value: "electronic", label: "Electronic"}
            ]
        }
    }
});

const no_songs_step = w.createStep({
    key: "quantity",
    prompt: { type: "text", content: "How many songs do you want in your playlist?" },
    reply: { 
        bodyType: "number",
        bodyLimits: {
            min: 1,
            max: 10
        }
    }
});

const motivation_step = w.createStep({
    key: "motivation",
    prompt: { type: "text", content: "What are you making the playlist for?" },
    reply: { 
        bodyType: "option",
        bodyLimits: {
            options: [
                { value: "party", label: "Party" },
                { value: "workout", label: "Workout" },
                { value: "chill", label: "Chill" }
            ]
        }
    }
});

const extras_step = w.createStep({
    key: "extras",
    prompt: { type: "text", content: "Are there any other preferences you would like to include?" },
    reply: {
        bodyType: "text",
        bodyLimits: {
            maxLength: 200
        }
    }
});

const scene = w.createScene({
    steps: [genre_step, no_songs_step, motivation_step, extras_step],
    handler: async (answers) => {
        const response = await fetch('http://localhost:2000/createplaylist', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                genre: answers.genre, 
                quantity: answers.quantity, 
                motivation: answers.motivation, 
                extras: answers.extras
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return [{ type: "text", content: `Playlist complete! You can view it here:` },
                { type: "text", content: `${data.final_playlist}`}
        ];
    },
});

const app = new w.AppServer();
app.addScene(command, scene);
app.start();
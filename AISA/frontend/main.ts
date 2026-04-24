import * as w from "@waylis/core";

let wallet_address_string = ""; 
const command = w.createCommand({ value: "curateplaylist", label: "Curate Playlist", description: "Curate a playlist based on your mood and preferences." });
const wallet_command = w.createCommand({ value: "setwallet", label: "Set Wallet", description: "Set wallet used to make nanopayments"});
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

const permission_step = w.createStep({
    key: "permission", 
    prompt: { type: "text", content: "Do you give permission for the AI Agent to use your wallet?"},
    reply: {
        bodyType: "option", 
        bodyLimits: {
            options: [
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" }
            ]
        }
    }
})

const wallet_address = w.createStep({
    key: "wallet",
    prompt: { type: "text", content: "Please enter your wallet address here:" },
    reply: {
        bodyType: "text",
        bodyLimits: {
            maxLength: 200
        }
    }
});

const wallet_mnemonic = w.createStep({
    key: "mnemonic",
    prompt: {type: "text", content: "Please enter your mnemonic here:"},
    reply:{
        bodyType: "text",
        bodyLimits: {
            maxLength: 200
        }
    }
});

const wallet_scene = w.createScene({
    steps: [wallet_address, wallet_mnemonic],
    handler: async (answers) => {
        const response = await fetch('http://localhost:2000/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    walletaddress: answers.wallet,
                    mnemonic: answers.mnemonic
                })
            });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json(); 

        if (data.outcome === true) {
            wallet_address_string = answers.mnemonic;
            return [{ type: "text", content: `Wallet set!` }];
        } else {
            return [{ type: "text", content: 'Error, please double check your credentials'}]
        }
    },
});

const scene = w.createScene({
    steps: [genre_step, no_songs_step, motivation_step, extras_step, permission_step],
    handler: async (answers) => {
        if (answers.permission == "yes") {
            const response = await fetch('http://localhost:2000/createplaylist', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    genre: answers.genre, 
                    quantity: answers.quantity, 
                    motivation: answers.motivation, 
                    extras: answers.extras,
                    mnemonic: wallet_address_string
                })
            });
        
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();

            if (data.outcome == 'OK') {
                return [{ type: "text", content: `Playlist complete! You can view it here:` },
                    { type: "text", content: `${data.final_playlist}`},
                    { type: "text", content: `Receipts:`},
                    { type: "text", content: `${data.playlist_receipts}`}
                ];
            } else {
                return [{type: "text", content: `Error: ${data.outcome}`}];
            }
        } else {
            return [{ type: "text", content: `Request terminated.`}];
        }
    },
});

const app = new w.AppServer();
app.addScene(command, scene);
app.addScene(wallet_command, wallet_scene);
app.start();
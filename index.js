import express from 'express'
import morgan from 'morgan'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'
import fetch from 'node-fetch'
dotenv.config()

//OPEN AI SPACE

const API_KEY_OPENAI = process.env.API_KEY_OPENAI
let PROMPT = null
const MAX_TOKENS = 100;
const TEMPERATURE = 0.5;

//_________
const PORT = process.env.PORT || 3001
const app = express()
app.use(cors())
const httpServer = createServer(app)
const io = new Server(httpServer, {
    cors: {
        origin: 'http://localhost:3000',
    }
})


app.use(morgan("dev"))

io.on('connection', (socket) => {
    console.log(`New client connected ${socket.id} 🚀`)

    socket.join('waitingRoom');
    
    io.emit('messageWelcome', {
        from: 'Server',
        body: `New client connected to room Waiting Room ⏲️`,
        room: 'waitingRoom'
    })

    socket.on('buzzer', (message) => {
        socket.broadcast.emit('buzzer', {
            from: socket.id,
            body: message
        })
    })

    socket.on('chat', (data) => {
        
        socket.to(data.room).emit('reply', {
            from: socket.id,
            body: data.message,
            room: data.room
        })
    })

    socket.on('joinRoom', room => {
        socket.leave('waitingRoom')
        socket.join(room)
        io.to(room).emit('messageWelcome', {
            from: 'Server',
            body: `New client connected to room ${room} ⏲️`,
            room: room
        })
    })

    socket.on('disconnect', () => {
        console.log(`Client disconnected ${socket.id}`)
    })


    // petición http a openai para completar el prompt a través de socket.io
    socket.on('peticion_httpOpenAi', (data) => {
        console.log('cliente pidiendo datos a openai con este prompt', data)
        PROMPT = data.message
        const room = data.room

            fetch('https://api.openai.com/v1/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY_OPENAI}`
                },
                body: JSON.stringify({
                    "model": "text-davinci-003",
                    "prompt": PROMPT,
                    "temperature": 0.7,
                    "max_tokens": 256,
                    "top_p": 1,
                    "frequency_penalty": 0.5,
                    "presence_penalty": 0
                }),
            })
            .then(response => response.json())
            .then(data => {
                io.to(room).emit('replyFromOpenAi', {
                    from: 'OpenAI',
                    body: data.choices[0].text,
                    room: room
                })
            })
            .catch((error) => {
                console.error('Error:', error);
            })

            // test para no gastar tokens
            // io.to(room).emit('replyFromOpenAi', {
            //     from: 'OpenAI',
            //     body: 'Estoy pensando...',
            //     room: data.room})
            
    })

})

httpServer.listen(3001, () => {
    console.log(`Server on port ${PORT}`)
})

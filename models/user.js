const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    name: {
        required: true,
        type: String,
        trim: true,
    },
    email: ({
        required: true,
        type: String,
        trim: true,
        validate: (value) => {
            const re = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;
            return value.match();
        },
        message: "Please enter valid email address",
    }),
    password: {
        required: true,
        type: String,
    },
    gender: {
        type: String,
        enum: ['male', 'female'],
        //required: true,
    },
    type: {
        type: String,
        default: 'user',
    },

    // cart
});



const User = mongoose.model('User', userSchema);
module.exports = User;
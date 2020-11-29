require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false })

app.use(cors())
app.use(express.static('public'))
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
})

// Parse dates from yyyy-mm-dd to Day(3) Month(3) Date Year
const parseDate = (date) => {
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const weekday = weekdays[new Date(date).getDay()]
  const month = months[parseInt(date.split('-')[1])-1]
  let day = date.split('-')[0]
  const year = date.split('-')[2]

  return `${weekday} ${month} ${year} ${day}`
}

// DB schemas
const userSchema = new Schema({
  username: { type: String, required: true },
  exercises: [{description: String, duration: Number, date:String}]
})

// DB models
const User = mongoose.model("User", userSchema)

// DB create new user
const createUser = (username, done) => {
  let user = new User({username: username})
  user.save((err, data) => {
    if (err) return console.log(err)
    done(null, data)
  })
}

// DB find users
const findUsers = (done) => {
  User.find().
  select('_id username')
  .exec((err, data) => {
    if (err) return console.log(err)
    done(null, data)
  })
}

// DB add exercise
const addExercise = (userId, description, duration, date, done) => {
  User.findByIdAndUpdate(userId, {$push: {"exercises": {description: description, duration: duration, date: date}}},
    {safe: true, upsert: true}, (err, data) => {
    if (err) return console.log(err)
    done(null, data)
  })
}

// DB get User Log
const getLog = (userId, done) => {
  User.findById(userId, (err, data) => {
    if (err) return console.log(err)
    done(null, data)
  })
}

// POST creating a new user
app.post('/api/exercise/new-user', (req, res) => {
  createUser(req.body.username, (err, data) => {
    res.json({
      _id: data._id,
      username: data.username
    })
  })
})

// GET find users
app.get('/api/exercise/users', (req, res) => {
  findUsers((err, data) => {
    res.json(data)
  })
})

// POST adding exercise to user
app.post('/api/exercise/add', (req, res) => {
  const userId = req.body.userId
  const description = req.body.description
  const duration = req.body.duration
  let date
  if (req.body.date) {
    date = req.body.date
  }
  else {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() > 8 ? now.getMonth() + 1 : `0${now.getMonth() + 1}`
    const day = now.getDate() > 9 ? now.getDate() : `0${now.getDate() }`
    date = `${year}-${month}-${day}`
  }
  addExercise(userId, description, duration, date, (err, data) => {
    res.json({
      _id: data._id,
      username: data.username,
      description: description,
      duration: parseInt(duration),
      date: parseDate(date)
    })
  })
})

// GET user logs
app.get('/api/exercise/log', (req, res) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const userId = req.query.userId
  const dateFrom = req.query.from
  const dateTo = req.query.to
  const limit = req.query.limit

  const filterDateFrom = exercise => {
    if (dateFrom) {
      const fromYear = parseInt(dateFrom.split('-')[0])
      const fromMonth = parseInt(dateFrom.split('-')[1])
      const fromDay = parseInt(dateFrom.split('-')[2])
      const exerciseYear = parseInt(exercise.date.split(' ')[3])
      const exerciseMonth = months.indexOf(exercise.date.split(' ')[1]) + 1
      const exerciseDay = parseInt(exercise.date.split(' ')[2])
      if (exerciseYear > fromYear) {
        return true
      } else if (exerciseYear === fromYear && exerciseMonth > fromMonth) {
        return true
      } else if (exerciseYear === fromYear && exerciseMonth === fromMonth && exerciseDay >= fromDay) {
        return true
      } else  {
        return false
      }
    } else {
      return true
    }
  }

  const filterDateTo = exercise => {
    if (dateTo) {
      const toYear = parseInt(dateTo.split('-')[0])
      const toMonth = parseInt(dateTo.split('-')[1])
      const toDay = parseInt(dateTo.split('-')[2])
      const exerciseYear = parseInt(exercise.date.split(' ')[3])
      const exerciseMonth = months.indexOf(exercise.date.split(' ')[1]) + 1
      const exerciseDay = parseInt(exercise.date.split(' ')[2])
      if (exerciseYear < toYear) {
        return true
      } else if (exerciseYear === toYear && exerciseMonth < toMonth) {
        return true
      } else if (exerciseYear === toYear && exerciseMonth === toMonth && exerciseDay <= toDay) {
        return true
      } else  {
        return false
      }
    } else {
      return true
    }
  }

  getLog(userId, (err, data) => {
    let response = {
      _id: data._id,
      username: data.username,
      count: 0,
      log: data.exercises.map(exercise => ({
        description: exercise.description,
        duration: exercise.duration,
        date: parseDate(exercise.date)
      })).filter(exercise => filterDateFrom(exercise))
      .filter(exercise => filterDateTo(exercise))
    }

    if (limit) {
      response.log = response.log.slice(0,parseInt(limit))
    }

    response.count = response.log.length
    res.json(response)
  })
  
  
})



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})

const Joi = require('joi');
const courses = [
    {
        id: 1,
        name: 'c1'
    },
    {
        id: 2,
        name: 'c2'
    },
    {
        id: 3,
        name: 'c3'
    }
];
module.exports = (app, authenticateJWT) => {
    app.get('/courses', authenticateJWT, (request, response) => {
        response.send(courses);
    });

    app.post('/courses', authenticateJWT, (request, response) => {
        const { error } = validateCourse(request.body); // destruttura l'oggetto in proprietà
        if (error) 
            return response.status(400).send(error.details[0].message);
        const course = {
            id: courses.length + 1,
            name: request.body.name
        };
        courses.push(course);
        response.send(course);
    });

    app.put('/courses/:id', authenticateJWT, (request, response) => {
        const course = courses.find(e => e.id === +request.params.id);
        if (!course) 
            return response.status(404).send('Course not found');
        const { error } = validateCourse(request.body);
        if (error)
            return response.status(400).send(error.details[0].message);
        course.name = request.body.name;
        response.send(course);
    });

    app.get('/courses/:id', authenticateJWT, (request, response) => {
        const course = courses.find(e => e.id === +request.params.id);
        if (!course) 
            return response.status(404).send('The course not exist');
        response.send(course);
        
    });

    app.delete('/courses/:id', authenticateJWT, (request, response) => {
        const idx = courses.findIndex(e => e.id === +request.params.id);
        if (idx === -1) 
            return response.status(404).send('The course not exist');
        const course = courses[idx];
        courses.splice(idx, 1);
        response.send(course);
        
    });
}

function validateCourse(course) {
    const schema = Joi.object({
        name: Joi.string().min(3).required()
    });
    const result = schema.validate(course);
    return result;
}
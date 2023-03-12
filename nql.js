const joi = require('joi');
const queryEngine = require ('./query-engine.js');
const fs = require('fs/promises');
const _ = require('lodash');
const { exec } = require('child_process');
const stringSimilarity = require('string-similarity');
const nqlEngine = require('./nql-engine.js');
const { result } = require('lodash');
const { executeQuery } = require('./query-engine.js');
const axios = require('axios');
const Message = require('./models/message.js');


module.exports = (app, authenticateJWT, dbMeta) => {

    app.post('/bot', async (request, response) => {
        authenticateJWT(request, response);
        try {
            const message = request.body.message;
            const googleToken = request.info.googleToken;

            const data = {
                queryInput: {
                    text: {
                        text: message,
                        languageCode: 'it'
                    },
                    languageCode: 'it'
                }
            };
        
            const botResponse = (await axios({
                url: `https://europe-west2-dialogflow.googleapis.com/v2/projects/insighter-wbmq/locations/europe-west2/agent/sessions/abc:detectIntent`,
                data: data,
                headers: {
                    Authorization: `Bearer ${googleToken}`
                },
                method: 'post'
            })).data;

            const intent = botResponse.queryResult.intent.displayName;
            const botResponseResult = botResponse.queryResult.parameters;
            if (intent === 'Query') {
                const columns = nqlEngine.dateColumns(botResponseResult.column || []);
                const columnOperation = nqlEngine.dateColumns(botResponseResult.columnOperation || [])[0] || null;
                const indipendentOperation = botResponseResult.indieOperation || [];
                const operations = botResponseResult.operation || [];
                const multiplier = botResponseResult.multiplier || 1;
                const namesOfParameters = nqlEngine.dateColumns(botResponseResult.paramname || []);
                const parameters = botResponseResult.param || [];
                const frequencyOperator = botResponseResult.frequencyOperator || [];
                const joins = botResponseResult.join || [];

                const datePeriod = botResponseResult['date-period'];
                const date = botResponseResult.date;
                const groupBy = nqlEngine.dateColumns(botResponseResult.groupby || []);
                
                let views = [];
                if (botResponseResult.view?.length > 0) {
                    views = botResponseResult.view;
                } else {
                    if (columns.length > 0) {
                        views = columns;
                    } else if (columnOperation) {
                        views = [columnOperation];
                    }
                }


                await nql(
                    message,
                    columns,
                    columnOperation,
                    indipendentOperation,
                    operations,
                    multiplier,
                    namesOfParameters,
                    parameters,
                    frequencyOperator,
                    joins,
                    datePeriod,
                    date,
                    groupBy,
                    views,
                    request,
                    response,
                    dbMeta
                );
            } else {
                const message = new Message();
                message.id = Date.now();
                message.type = 'text';
                if (botResponse.queryResult.fulfillmentMessages?.length) {
                    message.message = botResponse.queryResult.fulfillmentMessages[0].text.text[0] || botResponse.queryResult.fulfillmentText;
                } else {
                    message.message = botResponse.queryResult.fulfillmentText;
                }
                return response.send(message);
            }
        } catch (e) {
            console.log(e);
            const message = new Message();
            message.id = Date.now();
            message.type = 'text';
            message.message = 'Il bot è titubante';
            return response.send(message);
        }
        

    });

    // deprecated
    app.post('/nql', async (request, response) => {
        authenticateJWT(request, response);
        const schema = joi.object({
            input: joi.string().required(),
            columns: joi.array(),
            columnOperation: joi.array(),
            indieOperation: joi.array(),
            operation: joi.array(),
            multiplier: joi.number().required(),
            paramname: joi.array().required(),
            param: joi.array().required(),
            frequencyOperator: joi.string().allow(null),
            groupby: joi.array(),
            'date-period': joi.string().allow(null),
            date: joi.string().allow(null),
            view: joi.array()
        });
        const { error } = schema.validate(request.body);
        if (error) 
            return response.status(400).send(error.details[0].message);
        try {
            // ESTRAZIONE BODY
            const input = request.body.input || '';
            const columns = nqlEngine.dateColumns(request.body.column || []);
            const columnOperation = nqlEngine.dateColumns(request.body.columnOperation || [])[0] || null;
            const indipendentOperation = request.body.indieOperation || [];
            const operations = request.body.operation || [];
            const multiplier = request.body.multiplier || 1;
            const namesOfParameters = nqlEngine.dateColumns(request.body.paramname || []);
            const parameters = request.body.param || [];
            const frequencyOperator = request.body.frequencyOperator || [];
            const joins = request.body.join || [];

            const datePeriod = request.body['date-period'];
            const date = request.body.date;
            const groupBy = nqlEngine.dateColumns(request.body.groupby || []);
            let views = [];
            if (request.body.view?.length > 0) {
                views = request.body.view;
            } else {
                if (columns.length > 0) {
                    views = columns;
                } else if (columnOperation) {
                    views = [columnOperation];
                }
            }
            await nql(
                input,
                columns,
                columnOperation,
                indipendentOperation,
                operations,
                multiplier,
                namesOfParameters,
                parameters,
                frequencyOperator,
                joins,
                datePeriod,
                date,
                groupBy,
                views,
                request,
                response,
                dbMeta
            );
        } catch (err) {
            console.log(err);
            return response.status(500).send(err?.message);
        }
           
            
    });
}

async function nql(
    input,
    columns,
    columnOperation,
    indipendentOperation,
    operations,
    multiplier,
    namesOfParameters,
    parameters,
    frequencyOperator,
    joins,
    datePeriod,
    date,
    groupBy,
    views,
    request,
    response,
    dbMeta
) {

    for (const i in parameters) {
        if (typeof parameters[i] !== 'string') {
            continue;
        }
        parameters[i] = parameters[i].replace(/\"/g, '')
    }
    const fields = [...columns, columnOperation, ...groupBy].filter(e => e !== null);

    const inquiries = await dbMeta.Inquiry.findAll();
    // RISOLUZIONE DA TEMPLATE
    const regex = /\'|_| i | il | l\'| le | un | uno | gli | lo | una | la |qual è|dammi | quali sono |\?/;
    const comparableInput = input.replace(regex, ' ').toLowerCase();
    for (const template of inquiries) {
        const similarity = stringSimilarity.compareTwoStrings(comparableInput, template.text.replace(regex, ' ').toLowerCase()); 
        let query = template.query?.replace(/\r|\n|\t/g, '');
        if (similarity > 0.85 && query !== '') {
            
            console.log(`DA TEMPLATE ${query}`);
            //query = nqlEngine.parseMonths(query);
            //query = nqlEngine.fixQuery(query);
            const connection = await queryEngine.getConnection(template.connection, dbMeta);
            const results = await queryEngine.executeQuery(query, connection, dbMeta);
            if (results?.length > 0) {
                const message = new Message();
                message.data = results,
                message.id = Date.now();
                message.type = await nqlEngine.mayBeChart(results);
                return response.send(message);
            }
            break;
        }
    }

    const user = request.info.id;

    // RISOLUZIONE STATICA
    let {
        connection,
        results,
        finalQuery,
        tables,
        mapping
    } = await nqlEngine.staticQueries(
        views,
        operations,
        fields,
        groupBy,
        namesOfParameters,
        parameters,
        datePeriod,
        date,
        indipendentOperation,
        frequencyOperator,
        columnOperation,
        columns,
        multiplier,
        joins,
        dbMeta,
        user
    );

    finalQuery = finalQuery?.replace(/\r|\n/g, '') || '';

    // RISOLUZIONE DA GPT3
    if (!results?.length && false) {
        //gpt3();
    }

    // VISUALIZZAZIONE
    /*if (results?.length === 1) {
        const detailResults = await nqlEngine.getDetails(fields, connection, finalQuery, tables, dbMeta, mapping);
        await dbMeta.Inquiry.create({
            user: user,
            text: input,
            query: finalQuery,
            connection: connection.id
        });
        if (detailResults?.length > 0) {
            return response.send(nqlEngine.visualizeWithCard(detailResults[0]));
        }
    }*/
    const inquiry = await dbMeta.Inquiry.create({
        user: user,
        text: input,
        query: finalQuery,
        connection: connection?.id
    });
    const message = new Message();
    message.data = results.slice(0, 10),
    message.id = inquiry.id;
    message.message = await nqlEngine.visualize(results, connection, tables, mapping, input, finalQuery, dbMeta);
    message.type = await nqlEngine.mayBeChart(results);
    return response.send(message);
}


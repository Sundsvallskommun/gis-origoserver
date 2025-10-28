const conf = require('../../../conf/config');
//const url = require('url');
const nodemailer = require('nodemailer');

function sendReport(req, res, name, report, maplink) {
    const configOptions = Object.assign({}, conf['apiSave']);
    let transporter = nodemailer.createTransport({
        host: configOptions.smtp_host,
        port: configOptions.smtp_port,
        secure: false,
    });
    let mailOptions = {
        from: configOptions.mail_from,
        to: configOptions.mail_to,
        subject: configOptions.msg_subject,
        text: `Namn: ${name}\r\nProblem: ${report}\r\nKartlänk: ${maplink}`,
        html: `<p>Namn: ${name}</p><p>Problem: ${report}</p><p>Kartlänk: <a href="${maplink}">${maplink}</a></p>`
    };
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log('Fel:', error);
        }
        console.log('E-post skickat:', info.messageId);
    });
    res.status(200).json({status: 'ok'});
}

module.exports = {
  put: function (req, res, next) {
    const data = req.body;
    console.log(data);
    let name = '';
    let report = '';
    let maplink = '';
    if ('name' in data) {
      name = data.name;
    } else {
        next(new Error(`Missing required parameter name`));
        res.status(400).json({error: 'Missing required parameter name'});
    }
    if ('report' in data) {
      report = data.report;
    } else {
        next(new Error(`Missing required parameter report`));
        res.status(400).json({error: 'Missing required parameter report'});
    }
    if ('maplink' in data) {
      maplink = data.maplink;
    }
    sendReport(req, res, name, report, maplink);
    // res.status(200).json({detaljplan: false});
  },
};

module.exports.put.apiDoc = {
  description: 'Handle ',
  operationId: 'saveReport',
  parameters: [
        {
            in: 'body',
            name: 'name',
            required: true,
            schema: { $ref: '#/definitions/Name'}
        },
        {
            in: 'body',
            name: 'report',
            required: false,
            schema: { $ref: '#/definitions/Report'}
        },
        {
            in: 'body',
            name: 'maplink',
            required: false,
            schema: { $ref: '#/definitions/MapLink'}
        }
    ],
  responses: {
    200: {
      description: 'Saves the report.',
      schema: {
        type: 'string',
      },
    },
    400: {
      description: 'Bad request',
      schema: {
        type: 'string',
      },
    },
    500: {
      description: 'Server error',
      schema: {
        type: 'string',
      },
    },
  },
};

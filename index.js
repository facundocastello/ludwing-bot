const { Telegraf } = require('telegraf');
const axios = require('axios');
const bot = new Telegraf('6485290701:AAHcoWt0PTtkarHcnFaFSJdAsQnZMf5dbmg');
// 7092778622:AAHKsbaDJfKgiP9BulpSAWyyu0-H0GC8bFU
bot.on('message', async (ctx) => {
	try {
			const message = ctx.update.message;
			let notes = message.from ? `Creado por: ${message.from.first_name||''} ${message.from.last_name||''} (${message.from.username||''} ${message.from.phone_number||''})` : '';
			const text = message.text || message.caption;
			if (text) {
					if((text) === 'ayuda')
							return ctx.reply(HELP_MESSAGE); 
						let photoIndex
					if(message.photo?.length){
						photoIndex = message.photo.findIndex(photo => photo.width > 500)
						photoIndex = photoIndex === -1 ? message.photo.length - 1 : photoIndex
					}
					const fileLink = (message?.document?.file_id || message?.photo?.length) && await ctx.telegram.getFileLink(message.document?.file_id || message.photo[photoIndex].file_id);
					const fileUrl = fileLink?.href;
					const captionLines = (text).split('\n');
					let providerName = null;
					let amount = null;
					let issueDate = null;
					let externalId = null;
					let paid = null;
					let id = undefined;

					captionLines.forEach(line => {
							line = line.trim();
							if (line.startsWith('editar:')) {
									id = line.substring(7).trim();
							}else if (line.startsWith('-')) {
									providerName = line.substring(1);
							} else
							if (line.startsWith('$')) {
									amount = line.substring(1).trim().replaceAll('.','').replace(/,/g, '.');
							} else if (line.startsWith('+')) {
									issueDate = line.substring(1).trim();
							} else if (line.startsWith('*')) {
									externalId = line.substring(1).trim();
							} else if (/pendiente|pagar|pagado/i.test(line)) {
									paid = line.toLowerCase() === 'pagado';
							}
					});
					if(!issueDate)
						issueDate = new Date().toLocaleDateString();

					const validCheck = {
						issueDate: !issueDate || isValidDate(issueDate),
						amount: !amount || isValidAmount(amount),
						factura: !externalId || isValidFactura(externalId)
					}
					
					// Validate da
					if(!issueDate && !amount && !externalId && paid === null) {
						ctx.reply(HELP_MESSAGE);
							return
						}
					if (!validCheck.issueDate || !validCheck.amount || !validCheck.factura ) {
							// send message to user
							ctx.reply(`La información es invalidad:\n
								- Fecha: ${validCheck.issueDate ? '✅' : issueDate + '❌'}\n
								- Amount: ${validCheck.amount ? '✅' : amount + '❌'}\n
								- Factura: ${validCheck.factura ? '✅' : factura + '❌'}\n
								`);
							return; // Stop processing if data is invalid
					}
					await postDataToUrl({fileUrl, providerName, amount, issueDate, externalId, notes, paid,id}, ctx);
			} else if(message?.document?.file_id || message?.photo?.length) {
					let photoIndex
					if(message.photo?.length){
						photoIndex = message.photo.findIndex(photo => photo.width > 500)
						photoIndex = photoIndex === -1 ? message.photo.length - 1 : photoIndex
					}
					const fileLink = (message?.document?.file_id || message?.photo?.length) && await ctx.telegram.getFileLink(message.document?.file_id || message.photo[photoIndex].file_id);
					const fileUrl = fileLink?.href;
					await postDataToUrl({fileUrl, notes}, ctx);
				}
	} catch (error) {
			console.error('Error handling the message:', error);
	}
});


bot.launch();
console.log('Bot is running...');

async function postDataToUrl({fileUrl, providerName, amount, issueDate, externalId, paid, notes, id}, ctx) {
		try{
			console.log({
				id,
				fileUrl: fileUrl,
        providerName: providerName,
        amount: amount,
        issueDate: issueDate,
        externalId,
        paid: paid,
				notes,
			})
			const response = await axios[id ? 'put':'post']('https://qfs8j9vv-3000.brs.devtunnels.ms/api/invoice', {
				id,
				fileUrl: fileUrl,
        providerName: providerName,
        amount: amount,
        issueDate: issueDate,
        externalId,
        paid: paid,
				notes,
			});
			if(!response.data.success) {
				ctx.reply(`Error sending data ${JSON.stringify(response.data.errors)}`);
				return
			}
			console.log(response.data)
			const invoice = response?.data?.invoice
			ctx.reply(`Se ${id?'editó': 'subió'} la factura a ${response.data.url}:
			- Proveedor: ${invoice?.provider?.name || '-'}
			- Monto: $${invoice?.price || '-'}
			- Fecha: ${invoice?.issueDate && new Date(invoice.issueDate).toLocaleDateString('es-AR')}
			- Factura: ${invoice?.externalId || '-'}
			- Pagado: ${invoice?.paid ? 'Si' : 'No'}
			`);
		}catch(e) {
			console.error(e)
		}
}


function isValidFactura(facturaStr) {
	// Regex to check if starts with 'A' or 'C', followed by a number, a dash, and another number
	const regex = /^[AC]\d+-\d+$/;
	return regex.test(facturaStr);
}

function isValidAmount(amountStr) {
	const amount = parseFloat(amountStr);
	return !isNaN(amount) && amount > 0; // Check if it's a number and greater than 0
}

function isValidDate(dateStr) {
	if (dateStr.toLowerCase() === 'hoy') {
			return true;  // 'hoy' is considered a valid issueDate
	}

	// Regular expression to check if the string matches the issueDate format DD/MM/YYYY
	const regex = /^(0?[1-9]|[12][0-9]|3[01])\/(0?[1-9]|1[012])\/(19|20)\d{2}$/;
	if (regex.test(dateStr)) {
			const [day, month, year] = dateStr.split('/').map(Number);
			const issueDate = new Date(year, month - 1, day); // JavaScript months are 0-based
			return issueDate.getFullYear() === year && issueDate.getMonth() === month - 1 && issueDate.getDate() === day;
	}
	return false;
}

const HELP_MESSAGE = `Por favor envia la siguiente informacion:

- Proveedor: Tiene que empezar con '-'
- Fecha: Tiene que empezar con '+' y ser DD/MM/YYYY
- Monto: Tiene que empezar con '$'
- Factura: El numero de factura tiene que empezar con '*'
- Tiene que decir "pendiente" o "pagado"
- Imagen o PDF de la factura
- No importa el orden de las cosas

Por ejemplo: 
-Limpimarket
+20/12/2024
*A1-1050
$123123
pagado

ó si quieres forzar:
-Limpimarket
pagado
FORZAR

`
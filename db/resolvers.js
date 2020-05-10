const Usuario = require('../models/Usuario');
const Producto = require('../models/Producto');
const Servicio = require('../models/Servicio');
const Cliente = require('../models/Cliente');
const Pedido = require('../models/Pedidos');

const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: 'variables.env' });

const crearToken = (usuario, secreta, expiresIn) => {
    //console.log(usuario);
    const { id, email,nombre, apellido } = usuario;
    return jwt.sign( { id, email, nombre, apellido }, secreta, { expiresIn } )
}

// Resolvers
const resolvers = {
    Query: {
        obtenerUsuario: async (_, {}, ctx) => {
            return ctx.usuario;
        },
        obtenerProductos: async () => {
            try {
                const productos = await Producto.find({});
                return productos; 
                
            } catch (error) {
                console.log(error);        
            }
        },
        obtenerProducto: async (_, { id }) => {
          // Revisar si elproducto existe
          const producto = await Producto.findById(id);

          if(!producto) {
              throw new Error('Producto no encontrado');
          }
          return producto;
        },
        obtenerServicios: async () => {
            try {
                const servicios = await Servicio.find({});
                return servicios; 
                
            } catch (error) {
                console.log(error);        
            }
        },
        obtenerServicio: async (_, { id }) => {
            // Revisar si el servicio existe
            const servicio = await Servicio.findById(id);
  
            if(!servicio) {
                throw new Error('Servicio no Encontrado');
            }
            return servicio;
          },
        obtenerClientes: async () => {
            try {
                const clientes = await Cliente.find({});
                return clientes; 
                
            } catch (error) {
                console.log(error);        
            }
        },
        obtenerClientesVendedor: async (_, {}, ctx ) => {
            try {
                const clientes = await Cliente.find({ vendedor: ctx.usuario.id.toString() });
                return clientes;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerCliente: async (_, { id }, ctx) => {
            // Revisar si el Cliente existe
            const cliente = await Cliente.findById(id);
  
            if(!cliente) {
                throw new Error('Cliente no Registrado');
            }

            // Solo debe verlo quien lo creó
            if(cliente.vendedor.toString() !== ctx.usuario.id) {
                throw new Error('No tiene permiso para ver este Cliente');
            }
              
            return cliente;
        },
        obtenerPedidos: async() => {
            try {
                const pedidos = await Pedido.find({});
                return pedidos; 
                
            } catch (error) {
                console.log(error);        
            }
        },
        obtenerPedidosVendedor: async (_, {}, ctx) => {
            try {
                const pedidos = await Pedido.find({ vendedor: ctx.usuario.id }).populate('cliente');
                return pedidos; 
                
            } catch (error) {
                console.log(error);        
            }
        },
        obtenerPedido: async (_, {id}, ctx) => {
            // Verificar si  el Pedido existe
            const pedido = await Pedido.findById(id);
            if(!pedido) {
                throw new Error('Pedido no encontrado');
            }
            // Solo lo puede ver el Vendedor que lo creo
            if(pedido.vendedor.toString() !== ctx.usuario.id) {
                throw new Error('No está autorizado a ver este pedido')
            }
            // Retornar el resultado
            return pedido;
        },
        obtenerPedidosEstado: async (_, { estado }, ctx) => {
            const pedidos = await Pedido.find({ vendedor: ctx.usuario.id, estado });
            return pedidos;
        },
        mejoresClientes: async () => {
            const clientes = await Pedido.aggregate([
                {$match : { estado: "COMPLETADO"}},
                {$group : {
                    _id: "$cliente",
                    total: { $sum: '$total'}
                }},
                {
                    $lookup: { 
                        from: 'clientes', 
                        localField: '_id',
                        foreignField: "_id",
                        as: "cliente"
                    }
                },
                {
                    $limit: 10
                },
                {
                    $sort: { total: -1}
                }
            ]);
            return clientes;
        },
        mejoresVendedores: async () => {
            const vendedores = await Pedido.aggregate([
                {$match : { estado: "COMPLETADO"}},
                {$group : {
                    _id: "$vendedor",
                    total: { $sum: '$total'}
                }},
                {
                    $lookup: { 
                        from: 'usuarios', 
                        localField: '_id',
                        foreignField: '_id',
                        as: 'vendedor'
                    }
                },
                {
                    $limit: 10
                },
                {
                    $sort: { total: -1}
                }
            ]);
            return vendedores;
        },
        buscarProducto: async(_, { texto }) => {
            const productos = await Producto.find({ $text: { $search: texto  } }).limit(10)

            return productos; 
        }
    },
    Mutation: {
        nuevoUsuario: async (_, { input } ) => {

            const { email, password } = input;
            
            // Revisar si el usuario ya está registrado
            const existeUsuario = await Usuario.findOne({email});
            if (existeUsuario) {
                throw new Error('El usuario ya está registrado');
            }
        
            // Hashear su password
            const salt = await bcryptjs.genSalt(10);
            input.password = await bcryptjs.hash(password, salt);

            try {
                // Guardarlo en la DB
                const usuario = new Usuario(input);
                usuario.save(); //Guarda
                return usuario;
            } catch (error) {
                console.log(error);
                
            }
        },
        autenticarUsuario: async (_, {input}) => {

            const { email, password } = input;

            // Controlar si el usuario existe
            const existeUsuario = await Usuario.findOne({email});
            if (!existeUsuario) {
                throw new Error('El usuario no existe');
            }

            // Revisar si el password es correcto
            const passwordCorrecto = await bcryptjs.compare( password, existeUsuario.password ); 
            if(!passwordCorrecto) {
                throw new Error('El Password es Incorrecto');
            }
            
            // Crear el TOKEN
            return {
                token: crearToken(existeUsuario, process.env.SECRETA, '24h')
            }
        },
        nuevoProducto: async (_, { input }) => {
            try {
                const producto = new Producto(input);

                // Almacenar en la DB
                const resultado = await producto.save();
                
                return resultado;

            } catch (error) {
                console.log(error);
                
            }
        },
        actualizarProducto: async (_, {id, input}) => {
            // Revisar si elproducto existe
          let producto = await Producto.findById(id);

          if(!producto) {
              throw new Error('Producto no Encontrado');
          }

          // Guardar en la DB
          producto = await Producto.findOneAndUpdate({_id: id}, input, { new: true });

          return producto;
        }, 
        eliminarProducto: async (_, { id }) => {
              // Revisar si elproducto existe
          let producto = await Producto.findById(id);

          if(!producto) {
              throw new Error('Producto no Encontrado');
          }

          // Eliminar
            await Producto.findOneAndDelete({_id: id});

          return "Producto Eliminado"
        },
        nuevoServicio: async (_, { input }) => {
            try {
                const servicio = new Servicio(input);

                // Almacenar en la DB
                const resultado = await servicio.save();
                return resultado;

            } catch (error) {
                console.log(error);    
            }
        },
        actualizarServicio: async (_, { id, input }) => {
            // Revisar si el servicio existe
          let servicio = await Servicio.findById(id);

          if(!servicio) {
              throw new Error('Servicio no Encontrado');
          }

          // Guardar en la DB
          servicio = await Servicio.findOneAndUpdate({_id: id}, input, { new: true });
          return servicio;
        },
        eliminarServicio: async (_, { id }) => {
            // Revisar si el servicio existe
        let servicio = await Servicio.findById(id);

        if(!servicio) {
            throw new Error('Servicio no Encontrado');
        }

        // Eliminar
        await Servicio.findOneAndDelete({_id: id});
        return "Servicio Eliminado"
      },
      nuevoCliente: async (_, {input}, ctx) => {

        //console.log(ctx);
        const { email } = input;
        
        // Verificar si el Cliente ya está registrado
        const cliente = await Cliente.findOne({ email });
        if(cliente) {
            throw new Error('El cliente ya está Registrado')
        }
        
        const nuevoCliente = new Cliente(input);
        // Asignar el vendedor
        nuevoCliente.vendedor = ctx.usuario.id;

        // Guardar en la DB

        try {
            const resultado = await nuevoCliente.save();
            return resultado;
        } catch (error) {
            console.log(error);
        }
      },
      actualizarCliente: async (_, { id, input }, ctx) => {
        // Verificar si el Cliente existe
        let cliente = await Cliente.findById(id);
        if(!cliente) {
            throw new Error('El cliente NO está Registrado')
        }

        // Verificar si el Vendedor es quien edita el Clinte
            if(cliente.vendedor.toString() !== ctx.usuario.id) {
            throw new Error('No tiene permiso para ver este Cliente');
        }

        // Guardar el Cliente modificado
        cliente = await Cliente.findOneAndUpdate({_id: id}, input, {new: true});
        return cliente;
      },
      eliminarCliente: async (_, { id }, ctx) => {
        // Verificar si el Cliente existe
        let cliente = await Cliente.findById(id);
        if(!cliente) {
            throw new Error('El cliente NO está Registrado')
        }

        // Verificar si el Vendedor es quien edita el Clinte
        if(cliente.vendedor.toString() !== ctx.usuario.id) {
            throw new Error('No tiene permiso para ver este Cliente');
        }
        // Eliminar Cliente
        await Cliente.findOneAndDelete({_id: id} );
        return "Cliente Eliminado"
      },
      nuevoPedido: async (_, {input}, ctx) => {
          
        const { cliente } = input 
        // Verificar si el Cliente existe  // cliente es el ID que vincula con el "CLIENTE"
        let clienteExiste = await Cliente.findById(cliente);
        if(!clienteExiste) {
            throw new Error('El cliente NO está Registrado')
        }
          // Verificar si el Cliente es del Vendedor
          if(clienteExiste.vendedor.toString() !== ctx.usuario.id ) {
            throw new Error('No tiene permiso para usar este Cliente');
        } 

          
              for await ( const articulo of input.pedido ) {
               const { id } = articulo;

               const producto = await Producto.findById(id);
               
               if(articulo.cantidad > producto.existencia) {
                   throw new Error(`El artículo: ${producto.nombre} excede la cantidad disponible`);
               } else {
                // Restar el pedido a la cantidad disponible
                producto.existencia = producto.existencia - articulo.cantidad;
                await producto.save();
            }
           }
          
          

           // Crear un nuevo Pedido
            const nuevoPedido = new Pedido(input)
          // ********************** Próximo: Verificar que el Servicio esté vigente
          // ********************** Hasta aquí
          
          // Asignar un Vendedor
          nuevoPedido.vendedor = ctx.usuario.id; 

          // Guardar en la DB
          const resultado = await nuevoPedido.save();
          return resultado;
      },
        actualizarPedido: async(_, {id, input}, ctx) => {

        const { cliente } = input;

        // Verificar si el Pedido existe
        const existePedido = await Pedido.findById(id);
        if(!existePedido) {
            throw new Error('El Pedido no existe')
        }
        // Verificar si el Cliente existe
        const existeCliente = await Cliente.findById(cliente);
        if(!existeCliente) {
            throw new Error('El Cliente no existe')
        }
        // Verificar si El Cliente y el Pedido pertenecen al Vendedor
            if(existeCliente.vendedor.toString() !== ctx.usuario.id ) {
            throw new Error('No tiene permiso para ver este Cliente');
        }
        // Revisar que es Stock esté disponible
        if( input.pedido ) {
        for await ( const articulo of input.pedido ) {
            const { id } = articulo;

            const producto = await Producto.findById(id);
            
            if(articulo.cantidad > producto.existencia) {
                        throw new Error(`El artículo: ${producto.nombre} excede la cantidad disponible`);
            } else {
             // Restar el pedido a la cantidad disponible
             producto.existencia = producto.existencia - articulo.cantidad;
             await producto.save();
         }
        } 

        // Guardar el Pedido
            const resultado = await Pedido.findOneAndUpdate({_id: id}, input, { new: true });
        return resultado;
      }},
      eliminarPedido: async (_, {id}, ctx) => {
        // Verificar si el Pedido existe
        const pedido = await Pedido.findById(id);
        if(!pedido) {
            throw new Error ('El Pedido no existe')
        }  
        
        // Verificar si el Vendedor es quién puede borrarlo
        if(pedido.vendedor.toString() !== ctx.usuario.id ) {
            throw new Error ('No tiene el permiso para hacerlo')
        }
        // Eliminar el registro
        await Pedido.findOneAndDelete({_id: id});
        return "Pedido eliminado";
      } 
    }
}

module.exports = resolvers;